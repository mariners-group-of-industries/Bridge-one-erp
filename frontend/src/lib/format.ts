const UNITS: [limitSeconds: number, divisor: number, suffix: string][] = [
  [60 * 60, 60, "m"],
  [60 * 60 * 24, 60 * 60, "h"],
  [60 * 60 * 24 * 7, 60 * 60 * 24, "d"],
  [60 * 60 * 24 * 30, 60 * 60 * 24 * 7, "w"],
  [60 * 60 * 24 * 365, 60 * 60 * 24 * 30, "M"],
];

/** Compact ERPNext-style age: "now", "5 m", "3 h", "2 d", "4 w", "3 M", "1 y". */
export function shortTimeAgo(value: string | Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  for (const [limit, divisor, suffix] of UNITS) {
    if (seconds < limit) return `${Math.floor(seconds / divisor)} ${suffix}`;
  }
  return `${Math.floor(seconds / (60 * 60 * 24 * 365))} y`;
}

/** Sentence form for form footers: "just now", "5 minutes ago", "2 days ago". */
export function timeAgo(value: string | Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  if (Math.abs(seconds) < 45) return "just now";
  let amount = seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(amount) < size) return format.format(-Math.round(amount), unit);
    amount /= size;
  }
  return format.format(-Math.round(amount), "year");
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export type CompanyDateFormat = "DD_MM_YYYY_SLASH" | "MM_DD_YYYY_SLASH" | "YYYY_MM_DD_DASH" | "DD_MM_YYYY_DASH";

function datePartsToString(year: string, month: string, day: string, format: CompanyDateFormat): string {
  switch (format) {
    case "DD_MM_YYYY_SLASH": return `${day}/${month}/${year}`;
    case "MM_DD_YYYY_SLASH": return `${month}/${day}/${year}`;
    case "YYYY_MM_DD_DASH":  return `${year}-${month}-${day}`;
    case "DD_MM_YYYY_DASH":  return `${day}-${month}-${year}`;
  }
}

export function formatCompanyDate(value: string, format: CompanyDateFormat): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return datePartsToString(year, month, day, format);
}

export function formatCompanyDateTime(value: string | Date, format: CompanyDateFormat): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = datePartsToString(String(date.getFullYear()), pad(date.getMonth() + 1), pad(date.getDate()), format);
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
