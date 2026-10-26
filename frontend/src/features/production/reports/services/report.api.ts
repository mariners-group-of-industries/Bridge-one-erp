import { ApiClientError, apiRequest } from "@/lib/api/client";
import type { Report, ReportLookups, ReportQuery } from "../schemas/report.schema";

const BASE = "/api/production/reports";

/** Query string of a report request (empty and false values left out). */
export const reportParams = (query: ReportQuery) =>
  new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== "" && value !== false)
      .map(([key, value]) => [key, String(value)]),
  );

export const fetchReport = (query: ReportQuery) => apiRequest<Report>(`${BASE}?${reportParams(query)}`);
export const fetchReportLookups = () => apiRequest<ReportLookups>(`${BASE}/lookups`);
export const reportPdfUrl = (query: ReportQuery) => `${BASE}/export-pdf?${reportParams(query)}`;

/** Downloads the report as Excel; API errors are thrown like `apiRequest`. */
export async function downloadReportExcel(query: ReportQuery) {
  let response: Response;
  try {
    response = await fetch(`${BASE}/export-excel?${reportParams(query)}`, { cache: "no-store" });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection.");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiClientError(response.status, "INTERNAL_ERROR", payload?.error?.message ?? `Download failed (${response.status}).`);
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "production-report.xlsx";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
