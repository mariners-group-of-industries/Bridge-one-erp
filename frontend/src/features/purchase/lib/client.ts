/** Browser-side helpers shared by the purchase pages. */
import { apiRequest } from "@/lib/api/client";

/** Today as yyyy-mm-dd in the user's own time zone (toISOString would give the UTC date). */
export function localToday(): string {
  return localDate(new Date());
}

/** A date as yyyy-mm-dd in the user's time zone. */
export function localDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** yyyy-mm-dd, `days` from today (negative for the past). */
export function localDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** Downloads rows as a UTF-8 CSV that Excel opens with the right characters. */
export function downloadCsv(fileName: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Query keys of every purchase list, so a save anywhere refreshes the others. */
export const PURCHASE_QUERY_KEYS = [
  "requisitions",
  "approvedReqs",
  "requisitionSummary",
  "purchaseOrders",
  "approvedPOs",
  "receivedGRNs",
  "eligibleGRNs",
  "returnsList",
  "supplierPayables",
  "supplierInvoices",
  "supplierBills",
  "supplierPaymentHistory",
  "supplierAdvances",
  "suppliers",
  "purchaseDashboard",
  "purchaseAnalytics",
  "report",
] as const;

/** Result of a purchase bulk import (shared with the Excel templates). */
export interface BulkImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

/** Uploads a filled template to `/api/v1/purchase/<doc>/import`. */
export async function uploadPurchaseBulk(path: string, file: File): Promise<BulkImportResult> {
  const form = new FormData();
  form.set("file", file);
  return apiRequest<BulkImportResult>(path, { method: "POST", body: form });
}

/**
 * Table date for purchase pages: always dd-mm-yyyy (e.g. "17-11-2026").
 * Accepts yyyy-mm-dd, ISO timestamps, or dd/mm/yyyy | dd-mm-yyyy; anything else is shown as is.
 */
export function tableDate(value?: string | null): string {
  if (!value) return "—";
  const v = value.trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dmy = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, "0")}-${dmy[2].padStart(2, "0")}-${dmy[3]}`;
  return v;
}
