import { apiRequest } from "@/lib/api/client";
import type {
  CreateCustomerGroupInput,
  CreateSectionInput,
  CustomerAttachmentDto,
  CustomerDto,
  CustomerFilters,
  CustomerFormOptions,
  CustomerImportResult,
  CustomerInput,
  CustomerList,
  SalesForceList,
} from "../schemas/customer.schema";

const BASE = "/api/configuration/entity-master-data/customers";

/** Query string of the search + filters (empty values left out). */
export function customerQuery(params: CustomerFilters & { page?: number; pageSize?: number }): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function upload(file: File): RequestInit {
  const form = new FormData();
  form.set("file", file);
  return { method: "POST", body: form };
}

type BuOption = { id: string; name: string; businessUnitId: string };

export const customerApi = {
  list: (params: CustomerFilters & { page: number; pageSize: number }) =>
    apiRequest<CustomerList>(`${BASE}?${customerQuery(params)}`),
  salesForce: (filters: CustomerFilters) => apiRequest<SalesForceList>(`${BASE}/sales-force?${customerQuery(filters)}`),
  get: (id: string) => apiRequest<CustomerDto>(`${BASE}/${id}`),
  create: (input: CustomerInput) => apiRequest<CustomerDto>(BASE, json("POST", input)),
  update: (id: string, input: CustomerInput) => apiRequest<CustomerDto>(`${BASE}/${id}`, json("PUT", input)),
  setActive: (id: string, isActive: boolean) =>
    apiRequest<{ id: string; isActive: boolean }>(`${BASE}/${id}/status`, json("PATCH", { isActive })),
  formOptions: () => apiRequest<CustomerFormOptions>(`${BASE}/form-options`),

  addGroup: (input: CreateCustomerGroupInput) =>
    apiRequest<BuOption & { parentId: string | null }>(`${BASE}/groups`, json("POST", input)),
  addSection: (input: CreateSectionInput) => apiRequest<BuOption>(`${BASE}/sections`, json("POST", input)),
  addThana: (input: { districtId: number; name: string }) =>
    apiRequest<{ id: string; name: string; districtId: number }>(`${BASE}/thanas`, json("POST", input)),
  addTaxBracket: (input: { officeId: string; name: string; ratePercent: string }) =>
    apiRequest<BuOption & { ratePercent: string | null }>(`${BASE}/tax-brackets`, json("POST", input)),

  addAttachment: (id: string, file: File) => apiRequest<CustomerAttachmentDto>(`${BASE}/${id}/attachments`, upload(file)),
  deleteAttachment: (id: string, attachmentId: string) =>
    apiRequest<void>(`${BASE}/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
  attachmentUrl: (id: string, attachmentId: string) => `${BASE}/${id}/attachments/${attachmentId}`,

  templateUrl: `${BASE}/import/template`,
  importFile: (file: File) => apiRequest<CustomerImportResult>(`${BASE}/import`, upload(file)),
};
