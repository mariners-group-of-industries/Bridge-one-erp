import { apiRequest } from "@/lib/api/client";
import type {
  CustomerCredit,
  CustomerInput,
  CustomerOption,
  CustomerUpdate,
  ItemInput,
  ItemOption,
  ItemUpdate,
  SalesLookups,
  SalesPersonInput,
  SalesPersonOption,
  SalesPersonUpdate,
  SetupKind,
  SetupLookups,
} from "../schemas/masters.schema";

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const byUnit = (businessUnitId: string, includeInactive = false) =>
  `?${new URLSearchParams({ businessUnitId, ...(includeInactive ? { includeInactive: "true" } : {}) })}`;

export const fetchSalesLookups = () => apiRequest<SalesLookups>("/api/sales/lookups");
export const fetchSetupLookups = (businessUnitId?: string) =>
  apiRequest<SetupLookups>(`/api/sales/setup${businessUnitId ? `?${new URLSearchParams({ businessUnitId })}` : ""}`);

export const fetchCustomers = (businessUnitId: string, includeInactive = false) =>
  apiRequest<CustomerOption[]>(`/api/sales/customers${byUnit(businessUnitId, includeInactive)}`);
export const createCustomer = (input: CustomerInput) => apiRequest<CustomerOption>("/api/sales/customers", json("POST", input));
export const updateCustomer = (id: string, input: CustomerUpdate) =>
  apiRequest<CustomerOption>(`/api/sales/customers/${id}`, json("PUT", input));
export const fetchCustomerCredit = (id: string, asOf: string) =>
  apiRequest<CustomerCredit>(`/api/sales/customers/${id}/credit?${new URLSearchParams({ asOf })}`);

export const fetchItems = (businessUnitId: string, includeInactive = false) =>
  apiRequest<ItemOption[]>(`/api/sales/items${byUnit(businessUnitId, includeInactive)}`);
export const createItem = (input: ItemInput) => apiRequest<ItemOption>("/api/sales/items", json("POST", input));
export const updateItem = (id: string, input: ItemUpdate) => apiRequest<ItemOption>(`/api/sales/items/${id}`, json("PUT", input));
export const fetchItemPending = (id: string) => apiRequest<{ pendingQty: number }>(`/api/sales/items/${id}/pending`);

export const fetchSalesPersons = (businessUnitId: string, includeInactive = false) =>
  apiRequest<SalesPersonOption[]>(`/api/sales/sales-persons${byUnit(businessUnitId, includeInactive)}`);
export const createSalesPerson = (input: SalesPersonInput) =>
  apiRequest<SalesPersonOption>("/api/sales/sales-persons", json("POST", input));
export const updateSalesPerson = (id: string, input: SalesPersonUpdate) =>
  apiRequest<SalesPersonOption>(`/api/sales/sales-persons/${id}`, json("PUT", input));

export const createSetupRecord = (kind: SetupKind, input: Record<string, unknown>) =>
  apiRequest<{ id: string }>(`/api/sales/setup/${kind}`, json("POST", input));
export const updateSetupRecord = (kind: SetupKind, id: string, input: { name: string; isDefault?: boolean }) =>
  apiRequest<void>(`/api/sales/setup/${kind}/${id}`, json("PUT", input));
export const deleteSetupRecord = (kind: SetupKind, id: string) =>
  apiRequest<void>(`/api/sales/setup/${kind}/${id}`, { method: "DELETE" });
