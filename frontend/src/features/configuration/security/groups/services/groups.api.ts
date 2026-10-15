import { apiRequest } from "@/lib/api/client";
import type { GroupList, PermissionGroupDto, PermissionGroupInput, UserGroupDto, UserGroupInput, UserOption } from "../schemas/groups.schema";

const BASE = "/api/configuration/security";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();
type ListParams = { search?: string; page: number; pageSize: number };

export const userGroupApi = {
  list: (params: ListParams) => apiRequest<GroupList>(`${BASE}/user-groups?${query(params)}`),
  userOptions: () => apiRequest<UserOption[]>(`${BASE}/user-groups/user-options`),
  get: (id: string) => apiRequest<UserGroupDto>(`${BASE}/user-groups/${id}`),
  create: (input: UserGroupInput) => apiRequest<UserGroupDto>(`${BASE}/user-groups`, json("POST", input)),
  update: (id: string, input: UserGroupInput) => apiRequest<UserGroupDto>(`${BASE}/user-groups/${id}`, json("PUT", input)),
  remove: (id: string) => apiRequest<void>(`${BASE}/user-groups/${id}`, { method: "DELETE" }),
};

export const permissionGroupApi = {
  list: (params: ListParams) => apiRequest<GroupList>(`${BASE}/permission-groups?${query(params)}`),
  get: (id: string) => apiRequest<PermissionGroupDto>(`${BASE}/permission-groups/${id}`),
  create: (input: PermissionGroupInput) => apiRequest<PermissionGroupDto>(`${BASE}/permission-groups`, json("POST", input)),
  update: (id: string, input: PermissionGroupInput) => apiRequest<PermissionGroupDto>(`${BASE}/permission-groups/${id}`, json("PUT", input)),
  remove: (id: string) => apiRequest<void>(`${BASE}/permission-groups/${id}`, { method: "DELETE" }),
};
