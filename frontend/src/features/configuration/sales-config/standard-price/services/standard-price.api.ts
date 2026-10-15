import { apiRequest } from "@/lib/api/client";
import type { SaveStandardPricesInput, StandardPriceFilter, StandardPriceImportResult, StandardPriceList, StandardPriceOptions } from "../schemas/standard-price.schema";

const BASE = "/api/configuration/sales-config/standard-prices";
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();

export const standardPriceApi = {
  options: () => apiRequest<StandardPriceOptions>(`${BASE}/options`),
  list: (filter: StandardPriceFilter, page: number, pageSize: number) => apiRequest<StandardPriceList>(`${BASE}?${query({ ...filter, page, pageSize })}`),
  save: (input: SaveStandardPricesInput) => apiRequest<{ created: number; updated: number }>(BASE, { method: "PUT", body: JSON.stringify(input) }),
  excelUrl: (filter: StandardPriceFilter) => `${BASE}/excel?${query(filter)}`,
  pdfUrl: (filter: StandardPriceFilter) => `${BASE}/pdf?${query(filter)}`,
  importFile: (businessUnitId: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("businessUnitId", businessUnitId);
    return apiRequest<StandardPriceImportResult>(`${BASE}/import`, { method: "POST", body: form });
  },
};
