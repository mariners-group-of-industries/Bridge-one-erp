import { apiRequest } from "@/lib/api/client";
import type { ApprovalFormOptions, PipelineDto, PipelineInput, PipelineList } from "../schemas/approval.schema";

const BASE = "/api/configuration/security/approval-pipelines";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();

export const approvalApi = {
  list: (params: { search?: string; page: number; pageSize: number }) => apiRequest<PipelineList>(`${BASE}?${query(params)}`),
  formOptions: () => apiRequest<ApprovalFormOptions>(`${BASE}/options`),
  get: (id: string) => apiRequest<PipelineDto>(`${BASE}/${id}`),
  create: (input: PipelineInput) => apiRequest<PipelineDto>(BASE, json("POST", input)),
  update: (id: string, input: PipelineInput) => apiRequest<PipelineDto>(`${BASE}/${id}`, json("PUT", input)),
  remove: (id: string) => apiRequest<void>(`${BASE}/${id}`, { method: "DELETE" }),
  removeStage: (id: string, stageId: string) => apiRequest<PipelineDto>(`${BASE}/${id}/stages/${stageId}`, { method: "DELETE" }),
};
