import { z } from "zod";

import {
  getSupabaseProjectRef,
  getSupabaseStorageS3Endpoint,
} from "@/lib/supabase/project";

/** Vercel often stores unset vars as "" — treat those as missing so defaults apply. */
export function sanitizeEnv(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = typeof value === "string" && value.trim() === "" ? undefined : value;
  }
  return out;
}

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

function normalizeAppUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function defaultAppUrl(): string {
  const fromEnv = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (fromEnv) return fromEnv;
  // VERCEL_PROJECT_PRODUCTION_URL is always the production domain (e.g. virtual-data-room-mu.vercel.app).
  // VERCEL_URL is deployment-specific and changes per preview — avoid it for shareable links.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function isNextProductionBuild(): boolean {
  return (
    process.env.NEXT_BUILD === "1" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export" ||
    process.env.npm_lifecycle_event === "build"
  );
}

function buildPlaceholderEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse({
    ...sanitizeEnv(process.env),
    DATABASE_URL: process.env.DATABASE_URL?.trim() || "postgresql://build:build@127.0.0.1:5432/build",
    AUTH_SECRET:
      process.env.AUTH_SECRET?.trim() || "build-time-placeholder-secret-min-32-chars",
    STORAGE_DRIVER: "local",
  });

  if (parsed.success) return parsed.data;

  throw new Error(
    `Invalid environment configuration during build:\n${formatEnvIssues(
      parsed.error.issues.map((issue) => ({
        variable: issue.path.join(".") || "(root)",
        message: issue.message,
        hint: ENV_HINTS[issue.path.join(".") || "(root)"],
      })),
    )}`,
  );
}

function defaultStorageDriver(): "local" | "s3" {
  // During `next build` on Vercel, env is analysed route-by-route — don't require S3 yet.
  if (isNextProductionBuild()) return "local";
  if (process.env.VERCEL === "1") return "s3";
  return "local";
}

const ENV_HINTS: Record<string, string> = {
  DATABASE_URL:
    "Supabase → Connect → Transaction pooler (port 6543) on Vercel; direct :5432 for local migrations.",
  AUTH_SECRET: "Run: openssl rand -base64 48 — signs upload tickets only (not login).",
  NEXT_PUBLIC_SUPABASE_URL: "Supabase → Project Settings → API → Project URL.",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase → API Keys → Publishable key (sb_publishable_…).",
  SUPABASE_SERVICE_ROLE_KEY:
    "Supabase → API Keys → Secret key — needed for signup (creates a confirmed user) and db:seed.",
  S3_BUCKET: "Supabase → Storage → bucket name (e.g. vault). Required on Vercel.",
  S3_REGION: "Supabase → Storage → S3 → Region (e.g. eu-central-1). Required on Vercel.",
  S3_ACCESS_KEY_ID: "Supabase → Storage → S3 → Access key ID.",
  S3_SECRET_ACCESS_KEY: "Supabase → Storage → S3 → Secret access key.",
  S3_ENDPOINT: "Optional override; auto-derived from NEXT_PUBLIC_SUPABASE_URL for Supabase projects.",
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
      emptyToUndefined,
      z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL").optional(),
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    NEXT_PUBLIC_APP_URL: z.preprocess(
      (value) => normalizeAppUrl(value) ?? defaultAppUrl(),
      z.string().url(),
    ),

    STORAGE_DRIVER: z.preprocess(
      emptyToUndefined,
      z.enum(["local", "s3"]).default(defaultStorageDriver()),
    ),
    STORAGE_LOCAL_DIR: z.preprocess(emptyToUndefined, z.string().default(".storage")),

    S3_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
    S3_REGION: z.preprocess(emptyToUndefined, z.string().optional()),
    S3_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    S3_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().optional()),

    MAX_UPLOAD_BYTES: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .default("104857600")
        .transform((value) => Number.parseInt(value, 10))
        .pipe(z.number().int().positive()),
    ),
  })
  .transform((value) => {
    const projectRef = value.NEXT_PUBLIC_SUPABASE_URL
      ? getSupabaseProjectRef(value.NEXT_PUBLIC_SUPABASE_URL)
      : null;
    const s3Endpoint =
      value.S3_ENDPOINT ??
      (projectRef ? getSupabaseStorageS3Endpoint(projectRef) : undefined);

    return { ...value, S3_ENDPOINT: s3Endpoint };
  })
  .superRefine((value, ctx) => {
    if (isNextProductionBuild()) return;

    if (!value.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required",
      });
    }
    if (!value.AUTH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required",
      });
    }

    if (!value.NEXT_PUBLIC_SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message: "NEXT_PUBLIC_SUPABASE_URL is required",
      });
    }
    if (!value.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
      });
    }

    if (value.STORAGE_DRIVER !== "s3") return;

    for (const key of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=s3`,
        });
      }
    }

    if (!value.S3_ENDPOINT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_ENDPOINT"],
        message:
          "Set NEXT_PUBLIC_SUPABASE_URL (Supabase project) or S3_ENDPOINT for non-Supabase S3 storage.",
      });
    }
  });

export interface EnvIssue {
  variable: string;
  message: string;
  hint?: string;
}

export function formatEnvIssues(issues: EnvIssue[]): string {
  return issues
    .map((issue) => {
      const hint = issue.hint ? `\n      → ${issue.hint}` : "";
      return `  - ${issue.variable}: ${issue.message}${hint}`;
    })
    .join("\n");
}

export function validateEnvironment(
  raw: NodeJS.ProcessEnv = process.env,
): { ok: true; env: z.infer<typeof envSchema> } | { ok: false; issues: EnvIssue[] } {
  const parsed = envSchema.safeParse(sanitizeEnv(raw));

  if (parsed.success) {
    return { ok: true, env: parsed.data };
  }

  const issues: EnvIssue[] = parsed.error.issues.map((issue) => {
    const variable = issue.path.join(".") || "(root)";
    return {
      variable,
      message: issue.message,
      hint: ENV_HINTS[variable],
    };
  });

  return { ok: false, issues };
}

function loadEnv(): z.infer<typeof envSchema> {
  const result = validateEnvironment(process.env);

  if (!result.ok) {
    throw new Error(
      `Invalid environment configuration:\n${formatEnvIssues(result.issues)}\n\n` +
        "Fix these in .env locally or Vercel → Settings → Environment Variables, then redeploy.\n" +
        "After deploy, open GET /api/health to verify database and storage connectivity.",
    );
  }

  return result.env;
}

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv(): z.infer<typeof envSchema> {
  // Never cache build-time placeholders — workers may reuse the same process.
  if (isNextProductionBuild()) {
    return buildPlaceholderEnv();
  }

  cachedEnv ??= loadEnv();
  return cachedEnv;
}

export const env: z.infer<typeof envSchema> = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== "string") return undefined;
    return getEnv()[prop as keyof z.infer<typeof envSchema>];
  },
});

export type Env = z.infer<typeof envSchema>;

export function getEnvHints(): Record<string, string> {
  return { ...ENV_HINTS };
}
