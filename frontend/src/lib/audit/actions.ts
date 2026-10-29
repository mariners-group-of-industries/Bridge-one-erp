/** Kinds of audited action (shared by the server recorder and the Audit Logs page). */
export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "IMPORT", "EXPORT", "UPLOAD", "APPROVE", "STATUS", "CANCEL", "REVOKE", "LOGIN", "LOGIN_FAILED", "LOGOUT"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
