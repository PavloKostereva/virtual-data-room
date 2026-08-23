
export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError("BAD_REQUEST", message, details);

export const unauthorized = (message = "You must be signed in to do that.") =>
  new AppError("UNAUTHORIZED", message);

export const forbidden = (message = "You do not have access to this item.") =>
  new AppError("FORBIDDEN", message);

export const notFound = (message = "This item no longer exists.") =>
  new AppError("NOT_FOUND", message);

export const conflict = (message: string, details?: unknown) =>
  new AppError("CONFLICT", message, details);

export const payloadTooLarge = (message: string) => new AppError("PAYLOAD_TOO_LARGE", message);

export const unsupportedMediaType = (message: string) =>
  new AppError("UNSUPPORTED_MEDIA_TYPE", message);
