import { apiRequest } from "@/lib/api/client";
import type { ReportQuery, ReportResult } from "../schemas/report.schema";

export function fetchReport(filters: ReportQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) params.set(key, String(value));
  }
  return apiRequest<ReportResult>(`/api/sales/reports?${params}`);
}
