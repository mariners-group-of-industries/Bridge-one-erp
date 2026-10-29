import type { ColumnKind, ReportCell } from "../schemas/report.schema";

/** Display text of a cell (dates DD-MM-YYYY, numbers with separators). */
export function cellText(kind: ColumnKind, value: ReportCell): string {
  if (value === null || value === undefined || value === "") return kind === "text" ? "" : "—";
  if (typeof value === "string") return kind === "date" ? value.split("-").reverse().join("-") : value;
  if (kind === "percent") return `${value.toFixed(2)}%`;
  const decimals = kind === "qty" ? { minimumFractionDigits: 2, maximumFractionDigits: 4 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return value.toLocaleString("en-US", decimals);
}
