import { z } from "zod";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// Audit Logs (Configuration › System Logs).

export { AUDIT_ACTIONS };

export const ACTION_LABELS: Record<(typeof AUDIT_ACTIONS)[number], string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  IMPORT: "Import",
  EXPORT: "Export",
  UPLOAD: "Upload",
  APPROVE: "Approve",
  STATUS: "Status change",
  CANCEL: "Cancel",
  REVOKE: "Revoke",
  LOGIN: "Login",
  LOGIN_FAILED: "Failed login",
  LOGOUT: "Logout",
};

const optionalDate = z
  .union([z.iso.date("Enter a valid date."), z.literal("")])
  .optional()
  .default("");

export const auditLogQuerySchema = z
  .object({
    feature: z.string().trim().max(100).optional().default(""),
    userId: z.string().trim().max(100).optional().default(""),
    actionType: z
      .union([z.enum(AUDIT_ACTIONS), z.literal("")])
      .optional()
      .default(""),
    from: optionalDate,
    to: optionalDate,
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "From date must be on or before To date.", path: ["to"] });
export type AuditLogQuery = z.input<typeof auditLogQuerySchema>;

export interface AuditLogRow {
  id: string;
  feature: string;
  actionType: string;
  userId: string | null;
  userName: string | null;
  method: string;
  path: string;
  entityId: string | null;
  status: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogList {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogOptions {
  features: string[];
  users: { id: string; name: string }[];
}
