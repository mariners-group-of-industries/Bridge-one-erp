import { apiRequest } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type {
  BillDetail,
  BillInput,
  AdvanceVoucherInput,
  BillRow,
  CollectionDetail,
  CollectionInput,
  CollectionList,
  CollectionListQuery,
  DueInvoice,
  DueCollectionInput,
  DueInvoiceQuery,
  GlAccountOption,
  DueListRow,
  DueQuery,
  LedgerRow,
} from "../schemas/collection.schema";

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function query(values: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) params.set(key, String(value));
  }
  return params.size ? `?${params}` : "";
}

const C = "/api/sales/collections";
export const fetchDueList = (filters: DueQuery) => apiRequest<DueListRow[]>(`${C}/due${query(filters)}`);
export const fetchDueInvoices = (filters: DueInvoiceQuery) => apiRequest<DueInvoice[]>(`${C}/due-invoices${query(filters)}`);
export const fetchLedger = (filters: DueQuery) => apiRequest<LedgerRow[]>(`${C}/ledger${query(filters)}`);
export const fetchCollections = (filters: CollectionListQuery) => apiRequest<CollectionList>(`${C}${query(filters)}`);
export const fetchCollection = (id: string) => apiRequest<CollectionDetail>(`${C}/${id}`);
export const createCollection = (input: CollectionInput) => apiRequest<CollectionDetail>(C, json("POST", input));
/** Due Collection: one money receipt per customer. */
export const createDueCollection = (input: DueCollectionInput) => apiRequest<{ id: string; number: string }[]>(`${C}/due-collection`, json("POST", input));
/** Advance Collection voucher: one advance per row. */
export const createAdvanceVoucher = (input: AdvanceVoucherInput) => apiRequest<{ id: string; number: string }[]>(`${C}/advance-voucher`, json("POST", input));
export const fetchGlAccounts = () => apiRequest<GlAccountOption[]>("/api/sales/gl-accounts");

/** The table on screen as an Excel or PDF file. */
export const exportTable = (format: "xlsx" | "pdf", title: string, headers: string[], rows: (string | number | null)[][]) =>
  downloadFile("/api/sales/table-export", `${title}.${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format, title, headers, rows }),
  });

export const adjustAdvance = (id: string, version: string, allocations: { deliveryId: string; amount: number }[]) =>
  apiRequest<CollectionDetail>(`${C}/${id}/adjust`, json("POST", { version, allocations }));
export const cancelCollection = (id: string, version: string, reason: string) => apiRequest<CollectionDetail>(`${C}/${id}/cancel`, json("POST", { version, reason }));

const B = "/api/sales/bills";
export const fetchBills = (filters: DueQuery) => apiRequest<BillRow[]>(`${B}${query(filters)}`);
export const fetchBill = (id: string, asOf: string) => apiRequest<BillDetail>(`${B}/${id}${query({ asOf })}`);
export const createBill = (input: BillInput, asOf: string) => apiRequest<BillDetail>(`${B}${query({ asOf })}`, json("POST", input));
export const cancelBill = (id: string, version: string, reason: string, asOf: string) =>
  apiRequest<BillDetail>(`${B}/${id}/cancel${query({ asOf })}`, json("POST", { version, reason }));
