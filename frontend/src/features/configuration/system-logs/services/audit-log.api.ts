import { apiRequest } from "@/lib/api/client";
import type { AuditLogList, AuditLogOptions, AuditLogQuery } from "../schemas/audit-log.schema";

const BASE = "/api/configuration/system-logs/audit-logs";
const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]]))).toString();

export const auditLogApi = {
  list: (params: AuditLogQuery) => apiRequest<AuditLogList>(`${BASE}?${query(params as Record<string, string | number | undefined>)}`),
  options: () => apiRequest<AuditLogOptions>(`${BASE}/options`),
};
