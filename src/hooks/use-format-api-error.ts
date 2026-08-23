"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { formatApiError } from "@/lib/format-api-error";

export function useFormatApiError() {
  const t = useTranslations("errors");
  return useCallback((error: unknown) => formatApiError(error, t), [t]);
}
