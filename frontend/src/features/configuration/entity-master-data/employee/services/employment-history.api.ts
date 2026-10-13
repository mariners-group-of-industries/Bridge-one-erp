import { apiRequest } from "@/lib/api/client";
import type { EmploymentHistoryDto, UpsertEmploymentHistoryInput } from "../schemas/employment-history.schema";

const BASE = "/api/configuration/entity-master-data/employees";

export const employmentHistoryApi = {
  get:    (id: string) => apiRequest<EmploymentHistoryDto[]>(`${BASE}/${id}/employment-history`),
  upsert: (id: string, input: UpsertEmploymentHistoryInput) =>
    apiRequest<EmploymentHistoryDto[]>(`${BASE}/${id}/employment-history`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};
