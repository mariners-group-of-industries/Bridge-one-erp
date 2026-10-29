import { db } from "@/lib/prisma/client";

/**
 * Audit trail: which feature a request touched and what kind of action it was,
 * worked out from the API path and method. Recording never fails the request.
 */

export { AUDIT_ACTIONS, type AuditAction } from "./actions";
import type { AuditAction } from "./actions";

/** API path prefix (after /api/) → feature name. Longest prefix wins. */
const FEATURES: [string, string][] = [
  ["auth", "Authentication"],
  ["configuration/company", "Company Profile"],
  ["configuration/business-units", "Business Units"],
  ["configuration/offices", "Offices"],
  ["configuration/warehouses", "Warehouses"],
  ["configuration/terms", "Terms & Conditions"],
  ["configuration/roles", "Roles"],
  ["configuration/org-options", "Organisation Options"],
  ["configuration/entity-master-data/employees", "Employee"],
  ["configuration/entity-master-data/items", "Item Profile"],
  ["configuration/entity-master-data/customers", "Customer Profile"],
  ["configuration/entity-master-data/suppliers", "Supplier Profile"],
  ["configuration/sales-config/offers", "Offer Setup"],
  ["configuration/sales-config/customer-prices", "Customer Price Setup"],
  ["configuration/sales-config/territories", "Sales Setup"],
  ["configuration/sales-config/standard-prices", "Standard Price Setup"],
  ["configuration/sales-config/wallets", "Wallet Setup"],
  ["configuration/sales-config/return-prices", "Sales Return Price Setup"],
  ["configuration/security/approval-pipelines", "Approval Setup"],
  ["configuration/security/user-groups", "User Group"],
  ["configuration/security/permission-groups", "Permission Group"],
  ["configuration/gateways/api-tokens", "API Configuration"],
  ["configuration/gateways/attendance-devices", "Attendance Devices"],
  ["hrm/attendance", "Attendance"],
  ["hrm/self-service/leaves", "Leave"],
  ["hrm/self-service/movements", "Movement"],
  ["hrm/payroll", "Payroll"],
  ["hrm/bonus", "Bonus"],
  ["hrm/increments", "Increment"],
  ["hrm/governance", "HR Governance"],
  ["configuration/system-logs", "Audit Logs"],
  ["sales/quotations", "Sales Quotation"],
  ["sales/orders", "Sales Order"],
  ["sales/deliveries", "Sales Delivery"],
  ["sales/bills", "Sales Bill"],
  ["sales/collections", "Sales Collection"],
  ["sales/returns", "Sales Return"],
  ["sales/customers", "Sales Customers"],
  ["sales/items", "Sales Items"],
  ["sales/sales-persons", "Sales Person"],
  ["sales/setup", "Sales Module Setup"],
  ["sales/stock", "Sales Stock"],
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const titleCase = (text: string) => text.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function featureOf(pathname: string): string {
  const path = pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  const match = FEATURES.filter(([prefix]) => path === prefix || path.startsWith(`${prefix}/`)).sort((a, b) => b[0].length - a[0].length)[0];
  if (match) return match[1];
  const parts = path.split("/").filter((p) => p && !UUID.test(p));
  return titleCase(parts.slice(-2).join(" ")) || "Other";
}

/** The action a request performed, or null when it is not worth recording (plain reads). */
export function actionOf(method: string, pathname: string): AuditAction | null {
  const last = pathname.replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? "";
  const verb = method.toUpperCase();
  // The attendance agent uploads every few minutes; its sync status is on the device instead.
  if (verb === "POST" && last === "punches") return null;
  // Business Analyst questions only read data.
  if (verb === "POST" && last === "assistant") return null;
  if (verb === "GET" || verb === "HEAD") return ["excel", "export", "pdf"].includes(last) ? "EXPORT" : null;
  if (verb === "DELETE") return "DELETE";
  if (last === "import") return "IMPORT";
  if (last === "attachments" || last === "attachment" || last === "photo" || last === "logo") return "UPLOAD";
  if (["approve", "approval", "submit", "reject"].includes(last)) return "APPROVE";
  if (["status", "running", "active"].includes(last)) return "STATUS";
  if (last === "cancel") return "CANCEL";
  if (last === "revoke") return "REVOKE";
  if (verb === "POST") return "CREATE";
  return "UPDATE";
}

export interface AuditEntry {
  feature: string;
  actionType: AuditAction;
  userId?: string | null;
  userName?: string | null;
  method: string;
  path: string;
  status: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db().auditLog.create({
      data: {
        feature: clip(entry.feature, 100)!,
        actionType: entry.actionType,
        userId: clip(entry.userId, 100),
        userName: clip(entry.userName, 150),
        method: entry.method.toUpperCase().slice(0, 10),
        path: clip(entry.path, 300)!,
        entityId: entry.path.match(UUID)?.[0] ?? null,
        status: entry.status,
        ipAddress: clip(entry.ipAddress, 64),
        userAgent: clip(entry.userAgent, 300),
      },
    });
  } catch {
    // The audit trail must never break the action it records.
  }
}

/** Client details of a request (first forwarded address when behind a proxy). */
export function clientOf(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ipAddress: forwarded || request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") };
}

/** Records a request handled by `apiHandler` when it changed something (or exported data). */
export async function auditRequest(request: Request, response: Response, actor: { id: string; name?: string }) {
  if (response.status >= 400) return;
  const url = new URL(request.url);
  const actionType = actionOf(request.method, url.pathname);
  if (!actionType) return;
  await recordAudit({
    feature: featureOf(url.pathname),
    actionType,
    userId: actor.id,
    userName: actor.name ?? null,
    method: request.method,
    path: url.pathname,
    status: response.status,
    ...clientOf(request),
  });
}
