import { ApiError } from "@/lib/api-client";

const GENERIC_SERVER_MESSAGE = "Something went wrong. Please try again.";

type ErrorTranslator = {
  (key: string): string;
  has?: (key: string) => boolean;
};

const STATUS_KEYS: Record<number, string> = {
  401: "status401",
  403: "status403",
  404: "status404",
  409: "status409",
  413: "status413",
  429: "status429",
  503: "status503",
};

function translateKey(t: ErrorTranslator, key: string): string | null {
  if (t.has && !t.has(key)) return null;
  const value = t(key);
  if (value.startsWith("errors.")) return null;
  return value;
}

export function formatApiError(error: unknown, t: ErrorTranslator): string {
  if (error instanceof ApiError) {
    if (error.message && error.message !== GENERIC_SERVER_MESSAGE) {
      return error.message;
    }

    const codeMessage = translateKey(t, `codes.${error.code}`);
    if (codeMessage) return codeMessage;

    const statusKey = STATUS_KEYS[error.status];
    if (statusKey) {
      const statusMessage = translateKey(t, statusKey);
      if (statusMessage) return statusMessage;
    }

    if (error.status >= 500) return translateKey(t, "server") ?? t("generic");
    return t("generic");
  }

  if (error instanceof TypeError) {
    if (/fetch|network|load failed|could not reach/i.test(error.message)) {
      return t("network");
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("generic");
}
