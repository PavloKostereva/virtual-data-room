import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/server/env";
import type {
  CreateDownloadUrlParams,
  CreateUploadUrlParams,
  StorageDriver,
  StoredObject,
  UploadTicket,
} from "@/server/storage/types";

const DEFAULT_UPLOAD_TTL_SECONDS = 15 * 60;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 10 * 60;

function asciiFileName(fileName: string): string {
  const base = fileName.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(0, 120);
  return base.replace(/^_+|_+$/g, "") || "download";
}

class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;

  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (!this.client) {
      const env = getEnv();
      this.client = new S3Client({
        region: env.S3_REGION ?? "auto",
        endpoint: env.S3_ENDPOINT || undefined,
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
    }
    return this.client;
  }

  private get bucket(): string {
    return getEnv().S3_BUCKET ?? "";
  }

  async createUploadUrl(params: CreateUploadUrlParams): Promise<UploadTicket> {
    const expiresIn = params.expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS;
    const url = await getSignedUrl(
      this.getClient(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        ContentType: params.contentType,
      }),
      { expiresIn },
    );

    return {
      url,
      method: "PUT",
      headers: { "content-type": params.contentType },
      key: params.key,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async createDownloadUrl(params: CreateDownloadUrlParams): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ResponseContentType: params.contentType,
      ...(params.disposition === "attachment"
        ? { ResponseContentDisposition: `attachment; filename="${asciiFileName(params.fileName)}"` }
        : {}),
    });

    return getSignedUrl(this.getClient(), command, {
      expiresIn: params.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS,
    });
  }

  async stat(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        key,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? null,
      };
    } catch {
      return null;
    }
  }

  async remove(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;

    for (let index = 0; index < keys.length; index += 1000) {
      const batch = keys.slice(index, index + 1000);
      await this.getClient().send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
    }
  }
}

export const s3StorageDriver = new S3StorageDriver();
