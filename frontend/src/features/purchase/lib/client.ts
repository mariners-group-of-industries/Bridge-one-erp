/** Browser-side helpers shared by the purchase pages. */

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
