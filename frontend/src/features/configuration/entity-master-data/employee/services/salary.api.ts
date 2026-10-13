import { apiRequest } from "@/lib/api/client";
import type { SalaryDto, UpsertSalaryInput } from "../schemas/salary.schema";

const BASE = "/api/configuration/entity-master-data/employees";

export const salaryApi = {
  get:    (id: string) => apiRequest<SalaryDto>(`${BASE}/${id}/salary`),
  upsert: (id: string, input: UpsertSalaryInput) =>
    apiRequest<SalaryDto>(`${BASE}/${id}/salary`, { method: "PUT", body: JSON.stringify(input) }),
};
