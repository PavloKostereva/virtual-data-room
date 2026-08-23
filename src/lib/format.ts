const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const unit = SIZE_UNITS[exponent] ?? "B";

  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
  locale = "en",
): string {
  return `${count.toLocaleString(locale)} ${count === 1 ? singular : plural}`;
}

function createRelativeFormatter(locale: string) {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
}

function createDateFormatter(locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
}

const RELATIVE_THRESHOLDS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
];

export function formatRelativeTime(isoDate: string, locale = "en"): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return "—";

  const relativeFormatter = createRelativeFormatter(locale);
  const dateFormatter = createDateFormatter(locale);
  const seconds = (timestamp - Date.now()) / 1000;

  // Skip second-precision: "9 seconds ago" vs "10 seconds ago" mismatches SSR hydration.
  if (Math.abs(seconds) < 60) {
    return relativeFormatter.format(0, "second");
  }

  let delta = seconds / 60;
  for (const [unit, step] of RELATIVE_THRESHOLDS) {
    if (Math.abs(delta) < step) {
      return relativeFormatter.format(Math.round(delta), unit);
    }
    delta /= step;
  }

  return dateFormatter.format(timestamp);
}

export function formatDateTime(isoDate: string, locale = "en"): string {
  const timestamp = new Date(isoDate).getTime();
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return Number.isNaN(timestamp) ? "—" : formatter.format(timestamp);
}

export function formatPercent(fraction: number): string {
  return `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`;
}
