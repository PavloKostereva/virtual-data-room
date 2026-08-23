

export interface UploadTicket {

  url: string;
  method: "PUT";

  headers: Record<string, string>;

  key: string;
  expiresAt: string;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType: string | null;
}

export interface CreateUploadUrlParams {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}

export interface CreateDownloadUrlParams {
  key: string;

  fileName: string;
  contentType: string;
  disposition: "inline" | "attachment";
  expiresInSeconds?: number;
}

export interface StorageDriver {
  readonly name: "local" | "s3";
  createUploadUrl(params: CreateUploadUrlParams): Promise<UploadTicket>;
  createDownloadUrl(params: CreateDownloadUrlParams): Promise<string>;

  stat(key: string): Promise<StoredObject | null>;

  remove(keys: readonly string[]): Promise<void>;
}
