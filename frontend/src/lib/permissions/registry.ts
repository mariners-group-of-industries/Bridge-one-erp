import { workspaces } from "@/lib/navigation/registry";
import type { Workspace } from "@/lib/navigation/types";

/**
 * The permission registry: every page of the built modules (from the module
 * navigation files) with the actions that apply to it. It is the one source of
 * truth for the permission matrix, the server's authorization and the menus.
 *
 * Adding a feature: register its page in the module's `navigation.ts`; it then
 * appears here with every action. Map its API in `api-rules.ts` if the API path
 * does not start with the page path.
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

/**
 * Every page offers every action, so the matrix is a full grid and an
 * administrator can grant any action anywhere. An action a page has no use for
 * (e.g. Approve on a report) is harmless: nothing checks it there.
 */
const ALL_ACTIONS: readonly PermissionAction[] = PERMISSION_ACTIONS;

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
    features.push({ key, permKey: permKeyOf(key), moduleId: workspace.id, moduleLabel: workspace.label, submodule, label, actions: ALL_ACTIONS });
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
