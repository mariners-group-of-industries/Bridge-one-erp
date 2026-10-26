import { apiRequest } from "@/lib/api/client";
import { downloadFile } from "@/lib/download";
import type {
  DeliveryForReturn,
  ReturnableDeliveryQuery,
  ReturnableDeliveryRow,
  ReturnDetail,
  ReturnInput,
  ReturnList,
  ReturnListQuery,
} from "../schemas/return.schema";

const BASE = "/api/sales/returns";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function query(values: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  return params.size ? `?${params}` : "";
}

export const fetchReturnableDeliveries = (filters: ReturnableDeliveryQuery) =>
  apiRequest<ReturnableDeliveryRow[]>(`${BASE}/deliveries${query(filters)}`);
export const fetchDeliveryForReturn = (deliveryId: string, editing?: string) =>
  apiRequest<DeliveryForReturn>(`${BASE}/deliveries/${deliveryId}${query({ editing })}`);

export const fetchReturns = (filters: ReturnListQuery) => apiRequest<ReturnList>(`${BASE}${query(filters)}`);
export const fetchReturn = (id: string) => apiRequest<ReturnDetail>(`${BASE}/${id}`);
export const createReturn = (input: ReturnInput) => apiRequest<ReturnDetail>(BASE, json("POST", input));
export const updateReturn = (id: string, version: string, data: ReturnInput) =>
  apiRequest<ReturnDetail>(`${BASE}/${id}`, json("PUT", { version, data }));
export const deleteReturn = (id: string, version: string, reason: string) =>
  apiRequest<void>(`${BASE}/${id}`, json("DELETE", { version, reason }));
export const approveReturn = (id: string, version: string) => apiRequest<ReturnDetail>(`${BASE}/${id}/approve`, json("POST", { version }));
export const receiveMarketReturn = (id: string, version: string, lines: { lineId: string; qty: number }[]) =>
  apiRequest<ReturnDetail>(`${BASE}/${id}/receive`, json("POST", { version, lines }));
export const qcMarketReturn = (id: string, version: string, lines: { lineId: string; qty: number }[]) =>
  apiRequest<ReturnDetail>(`${BASE}/${id}/qc`, json("POST", { version, lines }));

/** Return Note/Challan PDF: opened to print, or saved with `download`. */
export const returnChallanPdfUrl = (id: string, download = false) => `${BASE}/${id}/challan-pdf${download ? "?download=1" : ""}`;

/** Excel (.xlsx) of a Sales Return tab for the same filters. */
export const downloadReturnExcel = (tab: "deliveries" | "returns" | "market", filters: Record<string, unknown>) =>
  downloadFile(`${BASE}/export${query({ ...filters, tab })}`, `sales-return-${tab}.xlsx`);
