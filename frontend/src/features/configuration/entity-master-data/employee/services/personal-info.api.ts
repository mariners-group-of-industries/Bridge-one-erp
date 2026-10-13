import { apiRequest } from "@/lib/api/client";
import type {
  AccountSettingsDto,
  CreateRoleInput,
  CredentialsDto,
  OrgAccessDto,
  OrgOptionsDto,
  PersonalInfoDto,
  RoleDto,
  UpdateAccountSettingsInput,
  UpdateCredentialsInput,
  UpdateOrgAccessInput,
  UpdatePersonalInfoInput,
} from "../schemas/personal-info.schema";

const BASE = "/api/configuration/entity-master-data/employees";

export const personalInfoApi = {
  getPersonalInfo:    (id: string) => apiRequest<PersonalInfoDto>(`${BASE}/${id}/personal`),
  updatePersonalInfo: (id: string, input: UpdatePersonalInfoInput) =>
    apiRequest<PersonalInfoDto>(`${BASE}/${id}/personal`, { method: "PATCH", body: JSON.stringify(input) }),

  getSettings:    (id: string) => apiRequest<AccountSettingsDto>(`${BASE}/${id}/settings`),
  updateSettings: (id: string, input: UpdateAccountSettingsInput) =>
    apiRequest<AccountSettingsDto>(`${BASE}/${id}/settings`, { method: "PATCH", body: JSON.stringify(input) }),

  getCredentials:    (id: string) => apiRequest<CredentialsDto>(`${BASE}/${id}/credentials`),
  updateCredentials: (id: string, input: UpdateCredentialsInput) =>
    apiRequest<CredentialsDto>(`${BASE}/${id}/credentials`, { method: "PATCH", body: JSON.stringify(input) }),

  getOrgAccess:    (id: string) => apiRequest<OrgAccessDto>(`${BASE}/${id}/org-access`),
  updateOrgAccess: (id: string, input: UpdateOrgAccessInput) =>
    apiRequest<OrgAccessDto>(`${BASE}/${id}/org-access`, { method: "PUT", body: JSON.stringify(input) }),

  listRoles:  () => apiRequest<RoleDto[]>("/api/configuration/roles"),
  createRole: (input: CreateRoleInput) =>
    apiRequest<RoleDto>("/api/configuration/roles", { method: "POST", body: JSON.stringify(input) }),

  getOrgOptions: () => apiRequest<OrgOptionsDto>("/api/configuration/org-options"),
};
