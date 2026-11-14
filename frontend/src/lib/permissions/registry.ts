import { workspaces } from "@/lib/navigation/registry";
import type { Workspace } from "@/lib/navigation/types";

/**
 * The permission registry: every page of the built modules (from the module
 * navigation files) with the actions that apply to it. It is the one source of
 * truth for the permission matrix, the server's authorization and the menus.
 *
 * Adding a feature: register its page in the module's `navigation.ts`; it then
 * appears here with View / Create / Edit / Delete / Export. List it below only
 * when it needs other actions (reports, approvals, imports), and map its API in
 * `api-rules.ts` if the API path does not start with the page path.
 */

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "import", "assign", "manage"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
  import: "Import",
  assign: "Assign",
  manage: "Manage Permissions",
};

/** Column of `permission_group_entries` holding each action. */
export const ACTION_COLUMNS = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
  approve: "canApprove",
  export: "canExport",
  import: "canImport",
  assign: "canAssign",
  manage: "canManage",
} as const satisfies Record<PermissionAction, string>;

export interface PermissionFeature {
  /** Stable activity key: the page path, e.g. "/sales/orders". */
  key: string;
  /** Dotted prefix of its permission keys, e.g. "sales.orders" → "sales.orders.view". */
  permKey: string;
  moduleId: string;
  moduleLabel: string;
  /** The menu card the page sits in ("Transactions", "Reports" …), when the module has named cards. */
  submodule: string | null;
  label: string;
  actions: readonly PermissionAction[];
}

export interface PermissionModule {
  id: string;
  label: string;
  href: string;
  features: PermissionFeature[];
}

const CRUD: readonly PermissionAction[] = ["view", "create", "edit", "delete", "export"];
const REPORT: readonly PermissionAction[] = ["view", "export"];
const WITH_APPROVE: readonly PermissionAction[] = ["view", "create", "edit", "delete", "approve", "export"];
const WITH_IMPORT: readonly PermissionAction[] = ["view", "create", "edit", "delete", "export", "import"];

/** Pages whose actions differ from the default CRUD + Export. */
const FEATURE_ACTIONS: Record<string, readonly PermissionAction[]> = {
  // Overviews, dashboards and reports: read and download only.
  "/accounts": REPORT,
  "/accounts/financial-reports": REPORT,
  "/accounts/other-reports": REPORT,
  "/inventory": REPORT,
  "/inventory/inventory-reports": REPORT,
  "/inventory/transfer-report": REPORT,
  "/rtm/dashboard": REPORT,
  "/rtm/distributor-dashboard": REPORT,
  "/rtm/sales-executive-dashboard": REPORT,
  "/rtm/sales-analytics": REPORT,
  "/rtm/outlet-ledger": REPORT,
  "/rtm/outlet-tracking": REPORT,
  "/production/dashboard": REPORT,
  "/production/reports": REPORT,
  "/purchase/analytics": REPORT,
  "/purchase/reports": REPORT,
  "/sales/dashboard": REPORT,
  "/sales/reports": REPORT,
  "/sales/analytics": REPORT,
  "/configuration/system-logs/audit-logs": REPORT,
  "/approvals": REPORT,
  // Documents that go through approval.
  "/accounts/journal": WITH_APPROVE,
  "/accounts/budget": WITH_APPROVE,
  "/accounts/fund-transfers": WITH_APPROVE,
  "/accounts/expenses": WITH_APPROVE,
  "/purchase/requisitions": WITH_APPROVE,
  "/purchase/orders": WITH_APPROVE,
  "/purchase/receive": WITH_APPROVE,
  "/purchase/returns": WITH_APPROVE,
  "/purchase/supplier-payments": WITH_APPROVE,
  "/production/orders": WITH_APPROVE,
  "/inventory/stock-adjustment": WITH_APPROVE,
  "/rtm/distributor-stock-transfer-request": WITH_APPROVE,
  "/rtm/distributor-stock-adjustment": WITH_APPROVE,
  "/rtm/tour-plan-setup": WITH_APPROVE,
  "/inventory/item-stock-conversion": WITH_APPROVE,
  "/inventory/transfer-request": WITH_APPROVE,
  "/inventory/store-requisition": WITH_APPROVE,
  // BRG Connect tasks: "approve" = supervisor verify/reject, blocker verification and
  // governance edits; on the executive dashboard it is the MD decision.
  "/connect/tasks": WITH_APPROVE,
  "/connect/tasks/executive": WITH_APPROVE,
  "/sales/quotations": WITH_APPROVE,
  "/sales/orders": WITH_APPROVE,
  "/sales/returns": WITH_APPROVE,
  "/sales/collections": WITH_APPROVE,
  "/hrm/self-service/leave-movement": WITH_APPROVE,
  "/hrm/overtime": WITH_APPROVE,
  "/hrm/compensation/bonus": WITH_APPROVE,
  "/hrm/talent/increment": WITH_APPROVE,
  "/hrm/payroll": WITH_APPROVE,
  "/hrm/governance/pending-approval": ["view", "approve"],
  // Master data with Excel import.
  "/configuration/entity-master-data/employee": WITH_IMPORT,
  "/configuration/entity-master-data/item-profile": WITH_IMPORT,
  "/configuration/entity-master-data/customer-profile": WITH_IMPORT,
  "/configuration/entity-master-data/supplier-profile": WITH_IMPORT,
  "/configuration/sales-config/customer-price-setup": WITH_IMPORT,
  "/configuration/sales-config/standard-price-setup": WITH_IMPORT,
  "/configuration/sales-config/sales-return": WITH_IMPORT,
  "/configuration/sales-config/sales-setup": ["view", "create", "edit", "delete", "export", "import", "assign"],
  // One record per company / per person.
  "/configuration/business-config/company-profile": ["view", "edit"],
  "/hrm/self-service/profile": ["view", "edit"],
  // Access control: "Manage Permissions" edits users' access; "Assign" puts users in groups.
  "/configuration/security/permission-group": ["view", "create", "edit", "delete", "assign", "manage"],
};

/** The page that grants permission administration (users' ERP access and overrides). */
export const PERMISSION_ADMIN_FEATURE = "/configuration/security/permission-group";

export const permKeyOf = (featureKey: string) => featureKey.replace(/^\/+/, "").replace(/\//g, ".");
export const permissionKey = (featureKey: string, action: PermissionAction) => `${permKeyOf(featureKey)}.${action}`;

function moduleFeatures(workspace: Workspace): PermissionFeature[] {
  const seen = new Set<string>();
  const features: PermissionFeature[] = [];
  const add = (href: string, label: string, submodule: string | null) => {
    const key = href.split("?")[0];
    if (seen.has(key)) return;
    seen.add(key);
    features.push({ key, permKey: permKeyOf(key), moduleId: workspace.id, moduleLabel: workspace.label, submodule, label, actions: FEATURE_ACTIONS[key] ?? CRUD });
  };
  // Cards first, so pages carry their card as submodule; then shortcuts and flat links not in any card.
  for (const card of workspace.cards ?? []) for (const link of card.links) add(link.href, link.label, card.label.trim() || null);
  for (const link of [...(workspace.shortcuts ?? []), ...(workspace.sidebarLinks ?? [])]) add(link.href, link.label, null);
  return features;
}

let cache: PermissionModule[] | undefined;

/** Every built module with its permission features, in menu order. */
export function permissionModules(): PermissionModule[] {
  cache ??= workspaces.filter((w) => w.status === "active").map((w) => ({ id: w.id, label: w.label, href: w.href, features: moduleFeatures(w) }));
  return cache;
}

export function permissionFeatures(): PermissionFeature[] {
  return permissionModules().flatMap((m) => m.features);
}

export function findFeature(key: string): PermissionFeature | undefined {
  return permissionFeatures().find((f) => f.key === key);
}

/** Every permission key in the registry. */
export function allPermissionKeys(): string[] {
  return permissionFeatures().flatMap((f) => f.actions.map((a) => permissionKey(f.key, a)));
}

/**
 * The feature a page path belongs to: the longest feature key it equals or is
 * under, else the parent of a registered record route (e.g. an office form under
 * Business Units). Module landing pages ("/sales") return undefined.
 */
export function featureForPath(pathname: string): PermissionFeature | undefined {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  const byPrefix = permissionFeatures()
    .filter((f) => path === f.key || path.startsWith(`${f.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (byPrefix) return byPrefix;
  for (const workspace of workspaces) {
    for (const route of workspace.routes ?? []) {
      const pattern = new RegExp(`^${route.pattern.replace(/\[[^\]]+\]/g, "[^/]+")}$`);
      if (route.parent && pattern.test(path)) return featureForPath(route.parent);
    }
  }
  return undefined;
}

/** The built module whose landing page or pages contain `pathname`. */
export function moduleForPath(pathname: string): PermissionModule | undefined {
  const path = pathname.split("?")[0];
  return permissionModules().find((m) => path === m.href || path.startsWith(`${m.href}/`) || m.features.some((f) => path === f.key || path.startsWith(`${f.key}/`)));
}

// ─── Checking a set of granted keys ───────────────────────────────────────────

/** What a signed-in principal holds: everything (master, full-access group, write token) or a set of keys. */
export interface AccessGrants {
  all: boolean;
  /** Read-only API tokens: only View and Export, even with `all`. */
  readOnly?: boolean;
  keys: ReadonlySet<string>;
}

export const FULL_ACCESS: AccessGrants = { all: true, keys: new Set() };
export const NO_ACCESS: AccessGrants = { all: false, keys: new Set() };

export function grantsAllow(grants: AccessGrants | undefined, featureKey: string, action: PermissionAction): boolean {
  if (!grants) return false;
  if (grants.readOnly && action !== "view" && action !== "export") return false;
  return grants.all || grants.keys.has(permissionKey(featureKey, action));
}

/** Grants from the list `/api/auth/me` returns (["*"] = everything). */
export function grantsFromList(keys: readonly string[]): AccessGrants {
  return keys.includes("*") ? FULL_ACCESS : { all: false, keys: new Set(keys) };
}

/**
 * Whether a page URL may be opened: a feature page (or a record under it) needs
 * View on it, a module landing page needs View on any of its pages. Home, the
 * user's profile and unknown paths are not restricted here.
 */
export function pathAllowed(grants: AccessGrants | undefined, pathname: string): boolean {
  const feature = featureForPath(pathname);
  if (feature) return grantsAllow(grants, feature.key, "view");
  const mod = moduleForPath(pathname);
  return mod ? grantsAllowInModule(grants, mod.id) : true;
}

/** True when any page of the module (by id) allows `action`. */
export function grantsAllowInModule(grants: AccessGrants | undefined, moduleId: string, action: PermissionAction = "view"): boolean {
  const mod = permissionModules().find((m) => m.id === moduleId);
  return !!mod && mod.features.some((f) => grantsAllow(grants, f.key, action));
}
