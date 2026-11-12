import { AppError } from "@/lib/api/errors";
import { getAuthCookie } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
import { checkApiAccess } from "@/lib/permissions/api-rules";
import { FULL_ACCESS, grantsAllow, grantsAllowInModule, type AccessGrants, type PermissionAction } from "@/lib/permissions/registry";
import { resolveGrants } from "@/lib/permissions/resolve";
import { db } from "@/lib/prisma/client";
import { resolveTokenActor } from "./api-token";

export type Permission =
  | "configuration:read"
  | "configuration:write"
  | "employees:read"
  | "sales:read"
  | "sales:write"
  | "sales:approve"
  | "accounts:read"
  | "accounts:write"
  | "production:read"
  | "production:write"
  | "production:approve"
  | "purchase:read"
  | "purchase:write";

export interface Actor {
  id: string;
  /** Display name (user name, or "API token: …"), for the audit trail. */
  name?: string;
  role: string;
  /** True for the master account — always has every permission, bypasses future RBAC. */
  isMaster: boolean;
  permissions: ReadonlySet<Permission>;
  /** Companies this actor may access. "ALL" is reserved for system administrators. */
  companyScope: "ALL" | readonly string[];
  /** How the request authenticated; session users are authorized per page and action. */
  via?: "session" | "token";
  /** Effective page permissions (registry keys). Absent for internal/system actors. */
  grants?: AccessGrants;
  /** ERP Login "Hide Stock In Sales": stock levels are withheld in the Sales module. */
  hideStockInSales?: boolean;
}

export const ALL_PERMISSIONS: readonly Permission[] = [
  "configuration:read",
  "configuration:write",
  "employees:read",
  "sales:read",
  "sales:write",
  "sales:approve",
  "accounts:read",
  "accounts:write",
  "production:read",
  "production:write",
  "production:approve",
  "purchase:read",
  "purchase:write",
];

/**
 * Module-level permissions for code that still asks coarse questions ("may this
 * actor approve sales documents?"), derived from the page permissions.
 */
function coarsePermissions(grants: AccessGrants): ReadonlySet<Permission> {
  const any = (moduleId: string, actions: PermissionAction[]) => actions.some((a) => grantsAllowInModule(grants, moduleId, a));
  const write: PermissionAction[] = ["create", "edit", "delete"];
  const set = new Set<Permission>();
  const add = (permission: Permission, ok: boolean) => ok && set.add(permission);
  add("configuration:read", any("configuration", ["view"]));
  add("configuration:write", any("configuration", write));
  add("employees:read", any("hrm", ["view"]) || grantsAllow(grants, "/configuration/entity-master-data/employee", "view"));
  add("sales:read", any("sales", ["view"]));
  add("sales:write", any("sales", write));
  add("sales:approve", any("sales", ["approve"]));
  add("accounts:read", any("account", ["view"]));
  add("accounts:write", any("account", write));
  add("production:read", any("production", ["view"]));
  add("production:write", any("production", write));
  add("production:approve", any("production", ["approve"]));
  add("purchase:read", any("purchase", ["view"]));
  add("purchase:write", any("purchase", write));
  return set;
}

/** Why an account may not use the ERP right now, or null when it may. */
export function accountBlock(user: { isActive: boolean; erpAccess: boolean; status: string }): string | null {
  if (!user.isActive || user.status === "INACTIVE") return "This account is inactive.";
  if (user.status === "SUSPENDED") return "This account is suspended.";
  if (!user.erpAccess) return "ERP access is not enabled for this account.";
  return null;
}

/** A signed-in user's actor. Permissions are read on every request, so changes apply to open sessions at once. */
async function sessionActor(jti: string, userId: string): Promise<Actor | null> {
  const session = await db().userSession.findUnique({
    where: { jti },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          isMaster: true,
          isActive: true,
          erpAccess: true,
          status: true,
          hideStockInSales: true,
          permissionGroups: { select: { group: { select: { name: true, status: true, fullAccess: true, entries: true } } } },
          permissionOverrides: { select: { activityKey: true, action: true, effect: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || session.user.id !== userId) return null;
  const user = session.user;
  // The master account can never be locked out by these flags.
  if (!user.isMaster && accountBlock(user)) return null;
  const grants = user.isMaster ? FULL_ACCESS : resolveGrants(user.permissionGroups.map((g) => g.group), user.permissionOverrides);
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    isMaster: user.isMaster,
    permissions: user.isMaster ? new Set<Permission>(ALL_PERMISSIONS) : coarsePermissions(grants),
    companyScope: "ALL",
    via: "session",
    grants,
    hideStockInSales: !user.isMaster && user.hideStockInSales,
  };
}

export async function resolveActor(request: Request): Promise<Actor | null> {
  try {
    // Integrations call with `Authorization: Bearer b1_…` (Configuration › API Configuration).
    if (request.headers.get("authorization")) return await resolveTokenActor(request.headers.get("authorization"), request.method);

    const token = await getAuthCookie();
    if (!token) {
      if (
        process.env.ERP_DEV_AUTH_BYPASS === "true" &&
        process.env.NODE_ENV !== "test" &&
        !process.env.VITEST
      ) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          name: "System Master",
          role: "ADMINISTRATOR",
          isMaster: true,
          permissions: new Set<Permission>(ALL_PERMISSIONS),
          companyScope: "ALL",
          via: "session",
          grants: FULL_ACCESS,
        };
      }
      return null;
    }

    const payload = await verifyToken(token);
    return await sessionActor(payload.jti, payload.sub);
  } catch {
    return null;
  }
}

/** Whether the actor may perform `action` on the page `featureKey` (master always may). */
export function can(actor: Actor, featureKey: string, action: PermissionAction = "view"): boolean {
  return actor.isMaster || grantsAllow(actor.grants, featureKey, action);
}

/**
 * In-service check for an action on one page (e.g. approving sales orders). Actors
 * without page permissions (system jobs) fall back to the module-level permission.
 */
export function canOn(actor: Actor, featureKey: string, action: PermissionAction, legacy: Permission): boolean {
  // Signed-in master accounts carry full grants, so no separate master shortcut is needed.
  return actor.grants ? grantsAllow(actor.grants, featureKey, action) : actor.permissions.has(legacy);
}

/**
 * Authenticates the request. API tokens are checked against the route's coarse
 * `permission`; signed-in users against the page and action the API path and
 * method map to (src/lib/permissions/api-rules.ts). Unmapped routes are denied.
 */
export async function requireActor(
  request: Request,
  permission: Permission,
): Promise<Actor> {
  const actor = await resolveActor(request);
  if (!actor) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  }
  // Master bypasses permission checks entirely.
  if (actor.isMaster) return actor;
  if (actor.via === "token" && !actor.permissions.has(permission)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
  const check = checkApiAccess(actor.grants, request.method, new URL(request.url).pathname);
  if (!check.allowed) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.", check.required ? { required: check.required } : undefined);
  }
  return actor;
}

export function canAccessCompany(actor: Actor, companyId: string): boolean {
  return actor.isMaster || actor.companyScope === "ALL" || actor.companyScope.includes(companyId);
}

export function assertCompanyAccess(actor: Actor, companyId: string, entity: string): void {
  if (!canAccessCompany(actor, companyId)) {
    throw new AppError(404, "NOT_FOUND", `${entity} not found.`);
  }
}

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user's id for "last action by" foreign keys; null for API tokens and system actors. */
export function actorUserId(actor: Actor): string | null {
  return USER_ID.test(actor.id) ? actor.id : null;
}
