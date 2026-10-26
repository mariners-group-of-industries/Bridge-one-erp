import { apiRequest } from "@/lib/api/client";
import type {
  CreateEmployeeInput,
  CreateEmployeeResult,
  EmployeeFilterOptions,
  EmployeeFormOptions,
  EmployeeList,
  EmployeeListParams,
} from "../schemas/employee.schema";

const BASE = "/api/configuration/entity-master-data/employees";

export function employeeListSearch(params: EmployeeListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export const employeeApi = {
  list:          (params: EmployeeListParams) => apiRequest<EmployeeList>(`${BASE}?${employeeListSearch(params)}`),
  filterOptions: () => apiRequest<EmployeeFilterOptions>(`${BASE}/filter-options`),
  formOptions:   () => apiRequest<EmployeeFormOptions>(`${BASE}/form-options`),
  create:        (input: CreateEmployeeInput) => apiRequest<CreateEmployeeResult>(BASE, { method: "POST", body: JSON.stringify(input) }),
  importTemplateUrl: `${BASE}/import/template`,
  importFile: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return apiRequest<{ created: number; errors: { row: number; message: string }[] }>(`${BASE}/import`, { method: "POST", body: form });
  },
};
