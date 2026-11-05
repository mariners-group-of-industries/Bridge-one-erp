import { apiRequest } from "@/lib/api/client";
import type { AccessUser, EffectivePermissionsDto, PermissionGroupDto, PermissionGroupInput, PermissionGroupList, UserAccessDto, UserAccessInput } from "../schemas/access.schema";

const BASE = "/api/configuration/security";
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const permissionGroupApi = {
  list: (params: { search?: string; status?: string; page?: number; pageSize?: number }) =>
    apiRequest<PermissionGroupList>(`${BASE}/permission-groups?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))}`),
  get: (id: string) => apiRequest<PermissionGroupDto>(`${BASE}/permission-groups/${id}`),
  create: (input: PermissionGroupInput) => apiRequest<PermissionGroupDto>(`${BASE}/permission-groups`, json("POST", input)),
  update: (id: string, input: PermissionGroupInput) => apiRequest<PermissionGroupDto>(`${BASE}/permission-groups/${id}`, json("PUT", input)),
  duplicate: (id: string) => apiRequest<PermissionGroupDto>(`${BASE}/permission-groups/${id}/duplicate`, { method: "POST" }),
  remove: (id: string) => apiRequest<void>(`${BASE}/permission-groups/${id}`, { method: "DELETE" }),
  users: (id: string) => apiRequest<{ userIds: string[]; users: AccessUser[] }>(`${BASE}/permission-groups/${id}/users`),
  setUsers: (id: string, userIds: string[]) => apiRequest<{ userIds: string[] }>(`${BASE}/permission-groups/${id}/users`, json("PUT", { userIds })),
};

export const userAccessApi = {
  get: (userId: string) => apiRequest<UserAccessDto>(`${BASE}/users/${userId}/access`),
  update: (userId: string, input: UserAccessInput) => apiRequest<UserAccessDto>(`${BASE}/users/${userId}/access`, json("PATCH", input)),
  effective: (userId: string) => apiRequest<EffectivePermissionsDto>(`${BASE}/users/${userId}/effective-permissions`),
};
