import { downloadFile } from "@/lib/download";

/** A table shown on screen, ready for Excel / PDF. */
export interface ExportTable {
  title: string;
  headers: string[];
  rows: (string | number | null)[][];
}

/** Downloads the table as an Excel (.xlsx) or PDF file made on the server. */
export const exportTable = (format: "xlsx" | "pdf", title: string, headers: string[], rows: (string | number | null)[][]) =>
  downloadFile("/api/sales/table-export", `${title}.${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, title, headers, rows }),
  });
