import { featureForPath, grantsAllow, grantsAllowInModule, PERMISSION_ADMIN_FEATURE, type AccessGrants, type PermissionAction } from "./registry";

/**
 * Which permission each API request needs. An API path that starts with its
 * page's path (`/api/sales/orders/…` → page `/sales/orders`) needs no entry: the
 * page is found automatically. The rules below cover everything else; a route
 * that matches neither is denied to everyone but the master account
 * (tests/api-auth.test.ts fails when a route has no mapping).
 *
 * Patterns are matched segment by segment, `*` standing for one segment; the
 * most specific pattern wins.
 */

/** Modules (navigation ids) whose pages read shared lookups. */
type ModuleId = "purchase" | "inventory" | "production" | "sales" | "account" | "hrm" | "configuration";

export interface ApiRule {
  /** Page whose permission writes (and, unless `read` says otherwise, reads) need. */
  feature?: string;
  /** Fixed action instead of the one derived from method and path. */
  action?: PermissionAction;
  /** Who may read (GET/HEAD): any ERP user, or anyone who can view a page of these modules. */
  read?: "signed-in" | { anyViewIn: readonly ModuleId[] };
  /** Treat POST as a read too (e.g. building an export from data the client already shows). */
  postIsRead?: boolean;
  /** Only the master account (seeding, one-off maintenance). */
  masterOnly?: boolean;
}

const PAGE = {
  companyProfile: "/configuration/business-config/company-profile",
  businessUnits: "/configuration/business-config/business-units",
  employee: "/configuration/entity-master-data/employee",
  item: "/configuration/entity-master-data/item-profile",
  customer: "/configuration/entity-master-data/customer-profile",
  supplier: "/configuration/entity-master-data/supplier-profile",
  offer: "/configuration/sales-config/offer-setup",
  customerPrice: "/configuration/sales-config/customer-price-setup",
  salesSetup: "/configuration/sales-config/sales-setup",
  standardPrice: "/configuration/sales-config/standard-price-setup",
  wallet: "/configuration/sales-config/wallet-setup",
  returnPrice: "/configuration/sales-config/sales-return",
  approval: "/configuration/security/approval-setup",
  userGroup: "/configuration/security/user-group",
  permissionGroup: PERMISSION_ADMIN_FEATURE,
  apiTokens: "/configuration/gateways/api-configuration",
} as const;

const MASTER_DATA_READERS: readonly ModuleId[] = ["configuration", "sales", "production", "purchase", "inventory"];
const SALES_READERS: readonly ModuleId[] = ["configuration", "sales"];
const ALL_MODULES: readonly ModuleId[] = ["purchase", "inventory", "production", "sales", "account", "hrm", "configuration"];

export const API_RULES: Record<string, ApiRule> = {
  // ── Home ──
  "/api/home": { read: "signed-in" },

  // ── Configuration › Business Config (offices, warehouses and terms are read everywhere) ──
  "/api/configuration/company": { feature: PAGE.companyProfile, read: "signed-in" },
  "/api/configuration/business-units": { feature: PAGE.businessUnits, read: "signed-in" },
  "/api/configuration/offices": { feature: PAGE.businessUnits, read: "signed-in" },
  "/api/configuration/warehouses": { feature: PAGE.businessUnits, read: "signed-in" },
  "/api/configuration/terms": { feature: PAGE.businessUnits, read: "signed-in" },
  "/api/configuration/org-options": { read: "signed-in" },
  "/api/configuration/roles": { feature: PAGE.employee, read: "signed-in" },

  // ── Configuration › Entity Master Data ──
  "/api/configuration/entity-master-data/employees": { feature: PAGE.employee },
  "/api/configuration/entity-master-data/employees/form-options": { feature: PAGE.employee, read: { anyViewIn: ["configuration", "hrm"] } },
  "/api/configuration/entity-master-data/employees/filter-options": { feature: PAGE.employee, read: { anyViewIn: ["configuration", "hrm"] } },
  // Login credentials and data access decide who can sign in and what they see: permission administrators only.
  "/api/configuration/entity-master-data/employees/*/credentials": { feature: PAGE.permissionGroup, action: "manage" },
  "/api/configuration/entity-master-data/employees/*/org-access": { feature: PAGE.permissionGroup, action: "manage" },
  "/api/configuration/entity-master-data/items": { feature: PAGE.item },
  "/api/configuration/entity-master-data/items/categories": { feature: PAGE.item, read: { anyViewIn: MASTER_DATA_READERS } },
  "/api/configuration/entity-master-data/items/divisions": { feature: PAGE.item, read: { anyViewIn: MASTER_DATA_READERS } },
  "/api/configuration/entity-master-data/items/uoms": { feature: PAGE.item, read: { anyViewIn: MASTER_DATA_READERS } },
  "/api/configuration/entity-master-data/items/form-options": { feature: PAGE.item, read: { anyViewIn: MASTER_DATA_READERS } },
  "/api/configuration/entity-master-data/customers": { feature: PAGE.customer },
  "/api/configuration/entity-master-data/customers/form-options": { feature: PAGE.customer, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/entity-master-data/customers/groups": { feature: PAGE.customer, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/entity-master-data/customers/sections": { feature: PAGE.customer, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/entity-master-data/customers/tax-brackets": { feature: PAGE.customer, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/entity-master-data/customers/thanas": { feature: PAGE.customer, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/entity-master-data/customers/sales-force": { feature: PAGE.customer, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/entity-master-data/suppliers": { feature: PAGE.supplier },
  "/api/configuration/entity-master-data/suppliers/form-options": { feature: PAGE.supplier, read: { anyViewIn: ["configuration", "purchase"] } },
  "/api/configuration/entity-master-data/suppliers/groups": { feature: PAGE.supplier, read: { anyViewIn: ["configuration", "purchase"] } },
  "/api/configuration/entity-master-data/suppliers/tax-brackets": { feature: PAGE.supplier, read: { anyViewIn: ["configuration", "purchase"] } },
  "/api/configuration/entity-master-data/suppliers/thanas": { feature: PAGE.supplier, read: { anyViewIn: ["configuration", "purchase"] } },

  // ── Configuration › Sales Config ──
  "/api/configuration/sales-config/offers": { feature: PAGE.offer },
  "/api/configuration/sales-config/offers/options": { feature: PAGE.offer, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/sales-config/customer-prices": { feature: PAGE.customerPrice },
  "/api/configuration/sales-config/customer-prices/options": { feature: PAGE.customerPrice, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/sales-config/territories": { feature: PAGE.salesSetup },
  "/api/configuration/sales-config/territories/nodes/*/employees": { feature: PAGE.salesSetup, action: "assign" },
  "/api/configuration/sales-config/territories/customers": { feature: PAGE.salesSetup, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/sales-config/standard-prices": { feature: PAGE.standardPrice },
  "/api/configuration/sales-config/standard-prices/options": { feature: PAGE.standardPrice, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/sales-config/wallets": { feature: PAGE.wallet },
  "/api/configuration/sales-config/wallets/options": { feature: PAGE.wallet, read: { anyViewIn: SALES_READERS } },
  "/api/configuration/sales-config/return-prices": { feature: PAGE.returnPrice },
  "/api/configuration/sales-config/return-prices/options": { feature: PAGE.returnPrice, read: { anyViewIn: SALES_READERS } },

  // ── Configuration › Identity & Security ──
  "/api/configuration/security/approval-pipelines": { feature: PAGE.approval },
  "/api/configuration/security/approval-pipelines/options": { feature: PAGE.approval, read: { anyViewIn: ALL_MODULES } },
  "/api/configuration/security/user-groups": { feature: PAGE.userGroup },
  "/api/configuration/security/user-groups/user-options": { feature: PAGE.userGroup, read: { anyViewIn: ["configuration"] } },
  "/api/configuration/security/permission-groups": { feature: PAGE.permissionGroup },
  "/api/configuration/security/permission-groups/*/users": { feature: PAGE.permissionGroup, action: "assign" },
  "/api/configuration/security/permissions/definitions": { read: "signed-in" },
  "/api/configuration/security/users": { feature: PAGE.permissionGroup, action: "manage" },

  // ── Configuration › Community & Gateways ──
  "/api/configuration/gateways/api-tokens": { feature: PAGE.apiTokens },
  "/api/configuration/gateways/attendance-devices/options": { feature: "/configuration/gateways/attendance-devices", read: { anyViewIn: ["configuration", "hrm"] } },

  // ── HRM ──
  "/api/hrm/options": { read: { anyViewIn: ["hrm"] } },
  "/api/hrm/bonus": { feature: "/hrm/compensation/bonus" },
  "/api/hrm/increments": { feature: "/hrm/talent/increment" },
  "/api/hrm/governance/checklist": { feature: "/hrm/governance/settings" },
  "/api/hrm/governance/policies": { feature: "/hrm/governance/settings" },
  "/api/hrm/governance/records": { feature: "/hrm/governance/settings" },
  "/api/hrm/governance/pending": { feature: "/hrm/governance/pending-approval" },
  "/api/hrm/self-service/leaves": { feature: "/hrm/self-service/leave-movement" },
  "/api/hrm/self-service/movements": { feature: "/hrm/self-service/leave-movement" },

  // ── Sales (masters kept in Sales Setup; lookups read by every sales page) ──
  "/api/sales/bills": { feature: "/sales/collections" },
  "/api/sales/commissions": { feature: "/sales/targets" },
  "/api/sales/customers": { feature: "/sales/setup", read: { anyViewIn: ["sales"] } },
  "/api/sales/items": { feature: "/sales/setup", read: { anyViewIn: ["sales"] } },
  "/api/sales/sales-persons": { feature: "/sales/setup", read: { anyViewIn: ["sales"] } },
  "/api/sales/vehicles": { feature: "/sales/setup", read: { anyViewIn: ["sales"] } },
  "/api/sales/stock": { feature: "/sales/setup", read: { anyViewIn: ["sales"] } },
  "/api/sales/drivers": { read: { anyViewIn: ["sales"] } },
  "/api/sales/gl-accounts": { read: { anyViewIn: ["sales"] } },
  "/api/sales/warehouses": { read: { anyViewIn: ["sales"] } },
  "/api/sales/lookups": { read: { anyViewIn: ["sales"] } },
  "/api/sales/table-export": { read: { anyViewIn: ["sales"] }, postIsRead: true },

  // ── Accounts (every accounts page loads the shared store; all-data filters by page itself) ──
  "/api/accounts/all-data": { read: { anyViewIn: ["account"] } },
  "/api/accounts/seed": { masterOnly: true },
  "/api/accounts/chart-of-accounts": { feature: "/accounts/chart-of-accounts", read: { anyViewIn: ["account"] } },
  "/api/accounts/cost-centers": { feature: "/accounts/center-setup", read: { anyViewIn: ["account"] } },
  "/api/accounts/banking": { feature: "/accounts/banking", read: { anyViewIn: ["account"] } },

  // ── Purchase (/api/v1) ──
  "/api/v1/master": { read: { anyViewIn: ["purchase", "inventory"] } },
  "/api/v1/purchase/dashboard": { read: { anyViewIn: ["purchase"] } },
  "/api/v1/purchase/reports": { feature: "/purchase/reports" },
  "/api/v1/purchase/requisitions": { feature: "/purchase/requisitions" },
  "/api/v1/purchase/orders": { feature: "/purchase/orders" },
  "/api/v1/purchase/receive": { feature: "/purchase/receive" },
  "/api/v1/purchase/returns": { feature: "/purchase/returns" },
  "/api/v1/purchase/supplier-payments": { feature: "/purchase/supplier-payments" },
};

const segments = (path: string) => path.split("/").filter(Boolean);

/** The most specific rule whose pattern is a prefix of `pathname` (more segments first, then fewer wildcards). */
export function findApiRule(pathname: string): ApiRule | undefined {
  const parts = segments(pathname);
  let best: { rule: ApiRule; length: number; wildcards: number } | undefined;
  for (const [pattern, rule] of Object.entries(API_RULES)) {
    const p = segments(pattern);
    if (p.length > parts.length || !p.every((s, i) => s === "*" || s === parts[i])) continue;
    const wildcards = p.filter((s) => s === "*").length;
    if (!best || p.length > best.length || (p.length === best.length && wildcards < best.wildcards)) best = { rule, length: p.length, wildcards };
  }
  return best?.rule;
}

const APPROVE = new Set(["approve", "reject", "approval", "decision"]);
const EXPORT = new Set(["export", "excel", "pdf", "advice"]);
/** State changes on an existing record; approval transitions are checked again by the service. */
const EDIT = new Set(["status", "running", "active", "cancel", "revoke", "submit"]);
const READ_METHODS = new Set(["GET", "HEAD"]);

/** The action a request performs, from its method and last path segments. */
export function actionForRequest(method: string, pathname: string): PermissionAction {
  const parts = segments(pathname);
  const last = parts.at(-1)?.toLowerCase() ?? "";
  const verb = method.toUpperCase();
  if (parts.some((p) => APPROVE.has(p.toLowerCase()))) return "approve";
  if (last === "import") return "import";
  if (EXPORT.has(last)) return "export";
  if (READ_METHODS.has(verb)) return "view";
  if (EDIT.has(last)) return "edit";
  if (verb === "DELETE") return "delete";
  if (verb === "POST") return "create";
  return "edit";
}

/** The API rule for a request, falling back to the page whose path the API path starts with. */
export function ruleForRequest(pathname: string): ApiRule | undefined {
  const rule = findApiRule(pathname);
  if (rule) return rule;
  const feature = featureForPath(pathname.replace(/^\/api(?=\/)/, ""));
  return feature ? { feature: feature.key } : undefined;
}

export interface AccessCheck {
  allowed: boolean;
  /** What was required, for the 403 message and tests. */
  required?: { feature?: string; action: PermissionAction };
}

/** Whether a non-master principal with `grants` may perform `method` on `pathname`. */
export function checkApiAccess(grants: AccessGrants | undefined, method: string, pathname: string): AccessCheck {
  const rule = ruleForRequest(pathname);
  if (!rule || rule.masterOnly) return { allowed: false, required: { action: "manage" } };
  const action = rule.action ?? actionForRequest(method, pathname);
  const isRead = READ_METHODS.has(method.toUpperCase()) || (rule.postIsRead && method.toUpperCase() === "POST");
  if (isRead && rule.read && !rule.action) {
    if (rule.read === "signed-in") return { allowed: !!grants, required: { action: "view" } };
    const allowed = rule.read.anyViewIn.some((m) => grantsAllowInModule(grants, m, "view")) || (!!rule.feature && grantsAllow(grants, rule.feature, action));
    return { allowed, required: { feature: rule.feature, action: "view" } };
  }
  if (!rule.feature) return { allowed: false, required: { action } };
  return { allowed: grantsAllow(grants, rule.feature, action), required: { feature: rule.feature, action } };
}
