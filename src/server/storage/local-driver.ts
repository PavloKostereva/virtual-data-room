import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { badRequest, notFound } from "@/server/errors";
import { signStorageRequest, verifyStorageSignature } from "@/server/storage/signing";
import type {
  CreateDownloadUrlParams,
  CreateUploadUrlParams,
  StorageDriver,
  StoredObject,
  UploadTicket,
} from "@/server/storage/types";

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? ".storage");
const DEFAULT_UPLOAD_TTL_SECONDS = 15 * 60;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 10 * 60;

class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  async createUploadUrl(params: CreateUploadUrlParams): Promise<UploadTicket> {
    const expiresAt = Date.now() + (params.expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS) * 1000;
    const signature = signStorageRequest({
      key: params.key,
      operation: "put",
      expiresAt,
      contentType: params.contentType,
      disposition: "",
      fileName: "",
    });

    const search = new URLSearchParams({
      key: params.key,
      expiresAt: String(expiresAt),
      contentType: params.contentType,
      signature,
    });

    return {
      url: `/api/storage/local?${search.toString()}`,
      method: "PUT",
      headers: { "content-type": params.contentType },
      key: params.key,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async createDownloadUrl(params: CreateDownloadUrlParams): Promise<string> {
    const expiresAt =
      Date.now() + (params.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS) * 1000;
    const signature = signStorageRequest({
      key: params.key,
      operation: "get",
      expiresAt,
      contentType: params.contentType,
      disposition: params.disposition,
      fileName: params.fileName,
    });

    const search = new URLSearchParams({
      key: params.key,
      expiresAt: String(expiresAt),
      contentType: params.contentType,
      disposition: params.disposition,
      fileName: params.fileName,
      signature,
    });

    return `/api/storage/local?${search.toString()}`;
  }

  async stat(key: string): Promise<StoredObject | null> {
    try {
      const stats = await stat(resolveKey(key));
      return { key, size: stats.size, contentType: null };
    } catch {
      return null;
    }
  }

  async remove(keys: readonly string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(resolveKey(key), { force: true })));
  }
}

export function resolveKey(key: string): string {
  const resolved = path.resolve(ROOT, key);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
    throw badRequest("Invalid storage key.");
  }
  return resolved;
}

export interface LocalStorageRequest {
  key: string;
  expiresAt: number;
  contentType: string;
  disposition: string;
  fileName: string;
  signature: string;
}

export function assertValidLocalStorageRequest(
  operation: "put" | "get",
  request: LocalStorageRequest,
): void {
  const valid = verifyStorageSignature(
    {
      key: request.key,
      operation,
      expiresAt: request.expiresAt,
      contentType: request.contentType,
      disposition: request.disposition,
      fileName: request.fileName,
    },
    request.signature,
  );

  if (!valid) {
    throw badRequest("This upload link is invalid or has expired.");
  }
}

export async function writeLocalObject(key: string, body: ReadableStream<Uint8Array>) {
  const target = resolveKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(target));
}

export async function readLocalObject(key: string) {
  const target = resolveKey(key);
  const stats = await stat(target).catch(() => null);
  if (!stats) throw notFound("The stored file could not be found.");

  const { createReadStream } = await import("node:fs");
  return { size: stats.size, stream: Readable.toWeb(createReadStream(target)) };
}

export const localStorageDriver = new LocalStorageDriver();
