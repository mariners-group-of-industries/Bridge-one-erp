import { apiRequest } from "@/lib/api/client";
import type { AcademicDto, UpsertAcademicsInput } from "../schemas/academic.schema";

const BASE = "/api/configuration/entity-master-data/employees";

export const academicApi = {
  get:    (id: string) => apiRequest<AcademicDto[]>(`${BASE}/${id}/academics`),
  upsert: (id: string, input: UpsertAcademicsInput) =>
    apiRequest<AcademicDto[]>(`${BASE}/${id}/academics`, { method: "PUT", body: JSON.stringify(input) }),
};
