import { randomUUID } from "node:crypto";
import path from "node:path";
import { getEnv } from "@/server/env";
import { localStorageDriver } from "@/server/storage/local-driver";
import { s3StorageDriver } from "@/server/storage/s3-driver";
import type { StorageDriver } from "@/server/storage/types";

export function getStorage(): StorageDriver {
  return getEnv().STORAGE_DRIVER === "s3" ? s3StorageDriver : localStorageDriver;
}

export function buildStorageKey(params: { dataRoomId: string; fileName: string }): string {
  const extension = path.extname(params.fileName).slice(0, 16).toLowerCase();
  return `data-rooms/${params.dataRoomId}/objects/${randomUUID()}${extension}`;
}

export type { StorageDriver, UploadTicket } from "@/server/storage/types";
