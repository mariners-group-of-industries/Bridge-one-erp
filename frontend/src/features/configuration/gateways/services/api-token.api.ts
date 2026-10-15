import { apiRequest } from "@/lib/api/client";
import type { ApiTokenRow, GeneratedToken, GenerateTokenInput } from "../schemas/api-token.schema";

const BASE = "/api/configuration/gateways/api-tokens";

export const apiTokenApi = {
  list: () => apiRequest<ApiTokenRow[]>(BASE),
  generate: (input: GenerateTokenInput) => apiRequest<GeneratedToken>(BASE, { method: "POST", body: JSON.stringify(input) }),
  revoke: (id: string) => apiRequest<ApiTokenRow>(`${BASE}/${id}/revoke`, { method: "POST" }),
  remove: (id: string) => apiRequest<void>(`${BASE}/${id}`, { method: "DELETE" }),
};
