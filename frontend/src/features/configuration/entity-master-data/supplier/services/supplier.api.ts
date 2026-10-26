import { apiRequest } from "@/lib/api/client";
import type {
  CreateSupplierGroupInput,
  CreateTaxBracketInput,
  CreateThanaInput,
  SupplierAttachmentDto,
  SupplierDto,
  SupplierFilters,
  SupplierFormOptions,
  SupplierGroupOption,
  SupplierImportResult,
  SupplierInput,
  SupplierList,
  TaxBracketOption,
} from "../schemas/supplier.schema";

const BASE = "/api/configuration/entity-master-data/suppliers";

/** Query string of the list search + filters (empty values left out). */
export function supplierQuery(params: SupplierFilters & { page?: number; pageSize?: number }): string {
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

export const supplierApi = {
  list: (params: SupplierFilters & { page: number; pageSize: number }) =>
    apiRequest<SupplierList>(`${BASE}?${supplierQuery(params)}`),
  get: (id: string) => apiRequest<SupplierDto>(`${BASE}/${id}`),
  create: (input: SupplierInput) => apiRequest<SupplierDto>(BASE, json("POST", input)),
  update: (id: string, input: SupplierInput) => apiRequest<SupplierDto>(`${BASE}/${id}`, json("PUT", input)),
  formOptions: () => apiRequest<SupplierFormOptions>(`${BASE}/form-options`),

  addGroup: (input: CreateSupplierGroupInput) => apiRequest<SupplierGroupOption>(`${BASE}/groups`, json("POST", input)),
  addThana: (input: CreateThanaInput) =>
    apiRequest<{ id: string; name: string; districtId: number }>(`${BASE}/thanas`, json("POST", input)),
  addTaxBracket: (input: CreateTaxBracketInput) => apiRequest<TaxBracketOption>(`${BASE}/tax-brackets`, json("POST", input)),

  addAttachment: (id: string, file: File) => apiRequest<SupplierAttachmentDto>(`${BASE}/${id}/attachments`, upload(file)),
  deleteAttachment: (id: string, attachmentId: string) =>
    apiRequest<void>(`${BASE}/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
  attachmentUrl: (id: string, attachmentId: string) => `${BASE}/${id}/attachments/${attachmentId}`,

  exportUrl: (filters: SupplierFilters) => `${BASE}/export?${supplierQuery(filters)}`,
  templateUrl: `${BASE}/import/template`,
  importFile: (file: File) => apiRequest<SupplierImportResult>(`${BASE}/import`, upload(file)),
};
