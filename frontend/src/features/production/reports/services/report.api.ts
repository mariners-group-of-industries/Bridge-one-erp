import { apiRequest } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
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

/** Downloads the report as Excel. */
export const downloadReportExcel = (query: ReportQuery) => downloadFile(`${BASE}/export-excel?${reportParams(query)}`, "production-report.xlsx");
