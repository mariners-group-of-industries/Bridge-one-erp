import { apiRequest } from "@/lib/api/client";
import type { OfferDto, OfferInput, OfferKind, OfferList, OfferOptions, ParsedDiscountLines } from "../schemas/offer.schema";

const BASE = "/api/configuration/sales-config/offers";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const offerApi = {
  list: (params: { kind: OfferKind; search?: string; status?: string; page: number; pageSize: number }) => {
    const query = new URLSearchParams({ kind: params.kind, page: String(params.page), pageSize: String(params.pageSize) });
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    return apiRequest<OfferList>(`${BASE}?${query}`);
  },
  get: (id: string) => apiRequest<OfferDto>(`${BASE}/${id}`),
  create: (input: OfferInput) => apiRequest<OfferDto>(BASE, json("POST", input)),
  update: (id: string, input: OfferInput) => apiRequest<OfferDto>(`${BASE}/${id}`, json("PUT", input)),
  setActive: (id: string, isActive: boolean) => apiRequest<{ id: string; isActive: boolean }>(`${BASE}/${id}/status`, json("PATCH", { isActive })),
  options: () => apiRequest<OfferOptions>(`${BASE}/options`),
  discountTemplateUrl: `${BASE}/discount-template`,
  parseDiscountLines: (businessUnitId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("businessUnitId", businessUnitId);
    return apiRequest<ParsedDiscountLines>(`${BASE}/discount-lines`, { method: "POST", body: form });
  },
};
