import { apiRequest } from "@/lib/api/client";
import type { ReturnPriceFilter, ReturnPriceImportResult, ReturnPriceList, ReturnPriceOptions, SaveReturnPricesInput } from "../schemas/return-price.schema";

const BASE = "/api/configuration/sales-config/return-prices";
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();

export const returnPriceApi = {
  options: () => apiRequest<ReturnPriceOptions>(`${BASE}/options`),
  list: (filter: ReturnPriceFilter, page: number, pageSize: number) => apiRequest<ReturnPriceList>(`${BASE}?${query({ ...filter, page, pageSize })}`),
  save: (input: SaveReturnPricesInput) => apiRequest<{ created: number; updated: number }>(BASE, { method: "PUT", body: JSON.stringify(input) }),
  excelUrl: (filter: ReturnPriceFilter) => `${BASE}/excel?${query(filter)}`,
  pdfUrl: (filter: ReturnPriceFilter) => `${BASE}/pdf?${query(filter)}`,
  importFile: (businessUnitId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("businessUnitId", businessUnitId);
    return apiRequest<ReturnPriceImportResult>(`${BASE}/import`, { method: "POST", body: form });
  },
};
