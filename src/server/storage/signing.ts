import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

export type StorageOperation = "put" | "get";

interface SignaturePayload {
  key: string;
  operation: StorageOperation;
  expiresAt: number;

  contentType: string;
  disposition: string;
  fileName: string;
}

function serialise(payload: SignaturePayload): string {
  return [
    payload.operation,
    payload.key,
    payload.expiresAt,
    payload.contentType,
    payload.disposition,
    payload.fileName,
  ].join("\n");
}

export function signStorageRequest(payload: SignaturePayload): string {
  const authSecret = env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error("AUTH_SECRET is not configured.");
  }
  return createHmac("sha256", authSecret).update(serialise(payload)).digest("base64url");
}

export function verifyStorageSignature(payload: SignaturePayload, signature: string): boolean {
  if (Date.now() > payload.expiresAt) return false;

  const expected = Buffer.from(signStorageRequest(payload));
  const received = Buffer.from(signature);

  return expected.length === received.length && timingSafeEqual(expected, received);
}
