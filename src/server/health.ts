import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/server/db/prisma";
import { getEnvHints, sanitizeEnv, validateEnvironment } from "@/server/env";

const TRACKED_VARIABLES = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "STORAGE_DRIVER",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

export type HealthStatus = "ok" | "degraded" | "error";

export interface HealthCheckResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: HealthStatus;
  environment: string;
  appUrl: string;
  timestamp: string;
  checks: {
    configuration: HealthCheckResult & {
      variables: Record<string, { set: boolean; valid?: boolean }>;
      issues: Array<{ variable: string; message: string; hint?: string }>;
    };
    database: HealthCheckResult;
    storage: HealthCheckResult;
  };
  hints: Record<string, string>;
}

function auditVariables(): Record<string, { set: boolean; valid?: boolean }> {
  const sanitized = sanitizeEnv(process.env);
  const result: Record<string, { set: boolean; valid?: boolean }> = {};

  for (const key of TRACKED_VARIABLES) {
    const value = sanitized[key];
    const set = value !== undefined;
    let valid: boolean | undefined;

    if (key === "AUTH_SECRET" && set) valid = value.length >= 32;
    if (key === "NEXT_PUBLIC_SUPABASE_URL" && set) {
      try {
        new URL(value);
        valid = true;
      } catch {
        valid = false;
      }
    }
    if (key === "STORAGE_DRIVER" && set) valid = value === "local" || value === "s3";

    result[key] = { set, ...(valid !== undefined ? { valid } : {}) };
  }

  return result;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : "Database connection failed.",
      details: {
        hint: "Check DATABASE_URL — on Vercel use Supabase pooler (port 6543), not direct :5432.",
      },
    };
  }
}

async function checkStorage(validation: ReturnType<typeof validateEnvironment>): Promise<HealthCheckResult> {
  if (!validation.ok) {
    return { ok: false, message: "Skipped — fix configuration first." };
  }

  const cfg = validation.env;

  if (cfg.STORAGE_DRIVER !== "s3") {
    const onVercel = process.env.VERCEL === "1";
    return {
      ok: !onVercel,
      message: onVercel
        ? "STORAGE_DRIVER=local does not work on Vercel — set STORAGE_DRIVER=s3 and S3_* variables."
        : "Using local filesystem storage (development only).",
      details: { driver: "local", path: cfg.STORAGE_LOCAL_DIR },
    };
  }

  const started = Date.now();
  try {
    const client = new S3Client({
      region: cfg.S3_REGION ?? "auto",
      endpoint: cfg.S3_ENDPOINT || undefined,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: cfg.S3_SECRET_ACCESS_KEY ?? "",
      },
    });

    await client.send(new HeadBucketCommand({ Bucket: cfg.S3_BUCKET ?? "" }));

    return {
      ok: true,
      latencyMs: Date.now() - started,
      details: { driver: "s3", bucket: cfg.S3_BUCKET, region: cfg.S3_REGION },
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : "Storage check failed.",
      details: {
        driver: "s3",
        bucket: cfg.S3_BUCKET,
        hint:
          "Verify S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY and S3_BUCKET from Supabase Storage → S3.",
      },
    };
  }
}

export async function runHealthChecks(): Promise<HealthReport> {
  const validation = validateEnvironment(process.env);
  const variables = auditVariables();

  const configIssues = validation.ok
    ? []
    : validation.issues.map(({ variable, message, hint }) => ({ variable, message, hint }));

  if (validation.ok && validation.env.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!validation.env[key]) {
        configIssues.push({
          variable: key,
          message: "Missing or empty.",
          hint: getEnvHints()[key],
        });
      }
    }
  }

  const configurationOk = validation.ok && configIssues.length === 0;

  const [database, storage] = configurationOk
    ? await Promise.all([checkDatabase(), checkStorage(validation)])
    : [
        { ok: false, message: "Skipped — fix configuration first." },
        await checkStorage(validation),
      ];

  const checks = [configurationOk, database.ok, storage.ok];
  const status: HealthStatus = checks.every(Boolean)
    ? "ok"
    : checks.some(Boolean)
      ? "degraded"
      : "error";

  const appUrl =
    validation.ok && validation.env.NEXT_PUBLIC_APP_URL
      ? validation.env.NEXT_PUBLIC_APP_URL
      : process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

  return {
    status,
    environment: process.env.NODE_ENV ?? "production",
    appUrl,
    timestamp: new Date().toISOString(),
    checks: {
      configuration: {
        ok: configurationOk,
        variables,
        issues: configIssues,
        ...(configurationOk ? {} : { message: "One or more environment variables are missing or invalid." }),
      },
      database,
      storage,
    },
    hints: getEnvHints(),
  };
}
