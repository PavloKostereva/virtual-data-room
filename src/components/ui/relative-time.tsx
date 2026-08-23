"use client";

import { formatRelativeTime } from "@/lib/format";

export function RelativeTime({
  value,
  locale,
  className,
}: {
  value: string;
  locale: string;
  className?: string;
}) {
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {formatRelativeTime(value, locale)}
    </time>
  );
}
