import { apiRequest } from "@/lib/api/client";
import type {
  CustomerPriceDto,
  CustomerPriceInput,
  CustomerPriceRow,
  GroupPriceDto,
  GroupPriceInput,
  GroupPriceRow,
  PriceImportResult,
  PriceSetupList,
  PriceSetupOptions,
  PriceTab,
} from "../schemas/customer-price.schema";

const BASE = "/api/configuration/sales-config/customer-prices";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();

export const customerPriceApi = {
  listCustomer: (params: { search?: string; page: number; pageSize: number }) =>
    apiRequest<PriceSetupList<CustomerPriceRow>>(`${BASE}?${query({ tab: "customer", ...params })}`),
  listGroup: (params: { search?: string; page: number; pageSize: number }) =>
    apiRequest<PriceSetupList<GroupPriceRow>>(`${BASE}?${query({ tab: "group", ...params })}`),
  options: () => apiRequest<PriceSetupOptions>(`${BASE}/options`),

  getCustomer: (id: string) => apiRequest<CustomerPriceDto>(`${BASE}/customer/${id}`),
  saveCustomer: (input: CustomerPriceInput, id?: string) =>
    id ? apiRequest<CustomerPriceDto>(`${BASE}/customer/${id}`, json("PUT", input)) : apiRequest<CustomerPriceDto>(`${BASE}/customer`, json("POST", input)),
  setCustomerActive: (id: string, isActive: boolean) => apiRequest<{ id: string; isActive: boolean }>(`${BASE}/customer/${id}/status`, json("PATCH", { isActive })),

  getGroup: (id: string) => apiRequest<GroupPriceDto>(`${BASE}/group/${id}`),
  saveGroup: (input: GroupPriceInput, id?: string) =>
    id ? apiRequest<GroupPriceDto>(`${BASE}/group/${id}`, json("PUT", input)) : apiRequest<GroupPriceDto>(`${BASE}/group`, json("POST", input)),
  setGroupRunning: (id: string, isRunning: boolean) => apiRequest<{ id: string; isRunning: boolean }>(`${BASE}/group/${id}/running`, json("PATCH", { isRunning })),

  exportUrl: (tab: PriceTab, search: string) => `${BASE}/export?${query({ tab, search })}`,
  pdfUrl: (tab: PriceTab, search: string) => `${BASE}/pdf?${query({ tab, search })}`,
  templateUrl: (tab: PriceTab) => `${BASE}/template?tab=${tab}`,
  importFile: (tab: PriceTab, file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("tab", tab);
    return apiRequest<PriceImportResult>(`${BASE}/import`, { method: "POST", body: form });
  },
};
