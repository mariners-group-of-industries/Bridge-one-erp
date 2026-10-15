import { apiRequest } from "@/lib/api/client";
import type { AssignEmployeeInput, AssignmentDto, EmployeeOption, LayerInput, NodeInput, NodeUpdate, TerritoryCustomerList, TerritoryImportResult, TerritoryTree } from "../schemas/territory.schema";

const BASE = "/api/configuration/sales-config/territories";
const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
const qs = (params: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();

export const territoryApi = {
  tree: (businessUnitId?: string) => apiRequest<TerritoryTree>(`${BASE}?${qs({ businessUnitId })}`),
  addLayer: (businessUnitId: string, input: LayerInput) => apiRequest<unknown>(`${BASE}/layers`, json("POST", { businessUnitId, ...input })),
  updateLayer: (id: string, input: LayerInput) => apiRequest<unknown>(`${BASE}/layers/${id}`, json("PUT", input)),
  deleteLayer: (id: string) => apiRequest<void>(`${BASE}/layers/${id}`, { method: "DELETE" }),
  addNode: (input: NodeInput) => apiRequest<{ id: string }>(`${BASE}/nodes`, json("POST", input)),
  updateNode: (id: string, input: NodeUpdate) => apiRequest<unknown>(`${BASE}/nodes/${id}`, json("PUT", input)),
  deleteNode: (id: string) => apiRequest<void>(`${BASE}/nodes/${id}`, { method: "DELETE" }),
  assignments: (nodeId: string) => apiRequest<AssignmentDto[]>(`${BASE}/nodes/${nodeId}/employees`),
  employeeOptions: (nodeId: string) => apiRequest<EmployeeOption[]>(`${BASE}/nodes/${nodeId}/employee-options`),
  assign: (nodeId: string, input: AssignEmployeeInput) => apiRequest<AssignmentDto[]>(`${BASE}/nodes/${nodeId}/employees`, json("POST", input)),
  unassign: (nodeId: string, assignmentId: string) => apiRequest<AssignmentDto[]>(`${BASE}/nodes/${nodeId}/employees/${assignmentId}`, { method: "DELETE" }),
  customers: (params: { businessUnitId: string; nodeId: string; customerId?: string; search?: string; page: number; pageSize?: number }) =>
    apiRequest<TerritoryCustomerList>(`${BASE}/customers?${qs(params)}`),
  excelUrl: (businessUnitId: string, kind: "tree" | "customers", nodeId?: string) => `${BASE}/excel?${qs({ businessUnitId, kind, nodeId })}`,
  templateUrl: (businessUnitId: string) => `${BASE}/template?${qs({ businessUnitId })}`,
  upload: (businessUnitId: string, kind: "tree" | "customers", file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("businessUnitId", businessUnitId);
    form.set("kind", kind);
    return apiRequest<TerritoryImportResult>(`${BASE}/import`, {
      method: "POST",
      body: form,
    });
  },
};
