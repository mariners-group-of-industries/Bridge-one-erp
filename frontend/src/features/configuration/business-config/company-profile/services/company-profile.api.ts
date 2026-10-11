import { apiRequest } from "@/lib/api/client";
import type { BusinessUnitInput } from "../schemas/business-unit.schema";
import type { CompanyInput } from "../schemas/company.schema";
import {
  ASSET_KIND_SLUGS,
  type OfficeAssetKind,
  type OfficeInput,
  type WarehouseInput,
} from "../schemas/office.schema";
import type { CreateTermInput, TermsDomain, UpdateTermInput } from "../schemas/terms.schema";
import type {
  BusinessUnitDto,
  CompanyDto,
  OfficeAssetDto,
  OfficeDto,
  TermDto,
  WarehouseDto,
} from "../types";

const BASE = "/api/configuration";
const json = (body: unknown) => JSON.stringify(body);

export const companyApi = {
  get: () => apiRequest<CompanyDto | null>(`${BASE}/company`),
  save: (input: CompanyInput) =>
    apiRequest<CompanyDto>(`${BASE}/company`, { method: "PUT", body: json(input) }),
};

export const businessUnitApi = {
  list: () => apiRequest<BusinessUnitDto[]>(`${BASE}/business-units`),
  create: (input: BusinessUnitInput) =>
    apiRequest<BusinessUnitDto>(`${BASE}/business-units`, { method: "POST", body: json(input) }),
  update: (id: string, input: BusinessUnitInput) =>
    apiRequest<BusinessUnitDto>(`${BASE}/business-units/${id}`, { method: "PUT", body: json(input) }),
  remove: (id: string) => apiRequest<void>(`${BASE}/business-units/${id}`, { method: "DELETE" }),
};

export const officeApi = {
  list: (businessUnitId: string) =>
    apiRequest<OfficeDto[]>(`${BASE}/business-units/${businessUnitId}/offices`),
  get: (id: string) => apiRequest<OfficeDto>(`${BASE}/offices/${id}`),
  create: (businessUnitId: string, input: OfficeInput) =>
    apiRequest<OfficeDto>(`${BASE}/business-units/${businessUnitId}/offices`, {
      method: "POST",
      body: json(input),
    }),
  update: (id: string, input: OfficeInput) =>
    apiRequest<OfficeDto>(`${BASE}/offices/${id}`, { method: "PUT", body: json(input) }),
  remove: (id: string) => apiRequest<void>(`${BASE}/offices/${id}`, { method: "DELETE" }),
  uploadAsset: (officeId: string, kind: OfficeAssetKind, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<OfficeAssetDto>(
      `${BASE}/offices/${officeId}/assets/${ASSET_KIND_SLUGS[kind]}`,
      { method: "PUT", body: form },
    );
  },
  removeAsset: (officeId: string, kind: OfficeAssetKind) =>
    apiRequest<void>(`${BASE}/offices/${officeId}/assets/${ASSET_KIND_SLUGS[kind]}`, {
      method: "DELETE",
    }),
};

export const warehouseApi = {
  list: (officeId: string) => apiRequest<WarehouseDto[]>(`${BASE}/offices/${officeId}/warehouses`),
  create: (officeId: string, input: WarehouseInput) =>
    apiRequest<WarehouseDto>(`${BASE}/offices/${officeId}/warehouses`, {
      method: "POST",
      body: json(input),
    }),
  update: (id: string, input: WarehouseInput) =>
    apiRequest<WarehouseDto>(`${BASE}/warehouses/${id}`, { method: "PUT", body: json(input) }),
  remove: (id: string) => apiRequest<void>(`${BASE}/warehouses/${id}`, { method: "DELETE" }),
};

export const termsApi = {
  list: (businessUnitId: string, domain: TermsDomain) =>
    apiRequest<TermDto[]>(`${BASE}/business-units/${businessUnitId}/terms?domain=${domain}`),
  create: (businessUnitId: string, input: CreateTermInput) =>
    apiRequest<TermDto>(`${BASE}/business-units/${businessUnitId}/terms`, {
      method: "POST",
      body: json(input),
    }),
  update: (id: string, patch: UpdateTermInput) =>
    apiRequest<TermDto>(`${BASE}/terms/${id}`, { method: "PATCH", body: json(patch) }),
  remove: (id: string) => apiRequest<void>(`${BASE}/terms/${id}`, { method: "DELETE" }),
  reorder: (businessUnitId: string, domain: TermsDomain, orderedIds: string[]) =>
    apiRequest<TermDto[]>(`${BASE}/business-units/${businessUnitId}/terms/order`, {
      method: "PUT",
      body: json({ domain, orderedIds }),
    }),
};
