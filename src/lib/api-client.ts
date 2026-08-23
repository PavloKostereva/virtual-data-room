const GENERIC_SERVER_MESSAGE = "Something went wrong. Please try again.";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }

  get suggestedName(): string | null {
    const details = this.details;
    if (details && typeof details === "object" && "suggestedName" in details) {
      const value = (details as { suggestedName: unknown }).suggestedName;
      if (typeof value === "string") return value;
    }
    return null;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  shareToken?: string | null;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, shareToken, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (shareToken) headers["x-share-token"] = shareToken;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new TypeError("Could not reach the server. Check your internet connection and try again.");
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const hasStructuredError =
      payload && typeof payload === "object" && "error" in payload && payload.error != null;
    const error = hasStructuredError
      ? (payload as { error: ApiErrorPayload }).error
        : {
            code: "INTERNAL",
            message: GENERIC_SERVER_MESSAGE,
          };
    throw new ApiError(response.status, error);
  }

  return payload as T;
}

export function withQuery(path: string, params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}
