import { apiRequest } from "@/lib/api/client";
import type {
  MasterInput,
  MasterKind,
  Option,
  WorkCenterDetail,
  WorkCenterInput,
  WorkCenterListQuery,
  WorkCenterLookups,
  WorkCenterRow,
  WorkCenterUpdate,
} from "../schemas/work-center.schema";

const BASE = "/api/production/work-centers";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const fetchWorkCenters = (query: WorkCenterListQuery = {}) =>
  apiRequest<WorkCenterRow[]>(`${BASE}?${new URLSearchParams(Object.entries(query).filter(([, value]) => value) as [string, string][])}`);
export const fetchWorkCenter = (id: string) => apiRequest<WorkCenterDetail>(`${BASE}/${id}`);
export const createWorkCenter = (input: WorkCenterInput) => apiRequest<WorkCenterDetail>(BASE, json("POST", input));
export const updateWorkCenter = (id: string, input: WorkCenterUpdate) => apiRequest<WorkCenterDetail>(`${BASE}/${id}`, json("PUT", input));
export const setWorkCenterActive = (id: string, version: string, isActive: boolean) =>
  apiRequest<WorkCenterRow>(`${BASE}/${id}/status`, json("PUT", { version, isActive }));
export const fetchWorkCenterLookups = () => apiRequest<WorkCenterLookups>(`${BASE}/lookups`);
export const createWorkCenterMaster = (kind: MasterKind, input: MasterInput) => apiRequest<Option>(`${BASE}/masters/${kind}`, json("POST", input));
