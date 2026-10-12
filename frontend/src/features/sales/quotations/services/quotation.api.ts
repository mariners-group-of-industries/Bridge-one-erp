import { apiRequest } from "@/lib/api/client";
import type {
  QuotationAction,
  QuotationDetail,
  QuotationInput,
  QuotationListQuery,
  QuotationListRow,
} from "../schemas/quotation.schema";

const BASE = "/api/sales/quotations";

export function fetchQuotations(query: QuotationListQuery): Promise<QuotationListRow[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return apiRequest<QuotationListRow[]>(`${BASE}?${params}`);
}

export const fetchQuotation = (id: string) => apiRequest<QuotationDetail>(`${BASE}/${id}`);

export const createQuotation = (data: QuotationInput) =>
  apiRequest<QuotationDetail>(BASE, { method: "POST", body: JSON.stringify(data) });

export const updateQuotation = (id: string, version: string, data: QuotationInput) =>
  apiRequest<QuotationDetail>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify({ version, data }) });

export const deleteQuotation = (id: string) => apiRequest<void>(`${BASE}/${id}`, { method: "DELETE" });

export const changeQuotationStatus = (id: string, action: QuotationAction, version: string, reason?: string) =>
  apiRequest<QuotationDetail>(`${BASE}/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ action, version, reason }),
  });
