import { AppError } from "@/lib/api/errors";
import { getAuthCookie } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
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
  | "accounts:write";

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
];

/**
 * When RBAC is built, replace this with a real role→permission lookup.
 * The master account always bypasses this via isMaster in the JWT.
 */
function permissionsForRole(_role: string): ReadonlySet<Permission> {
  return new Set<Permission>(ALL_PERMISSIONS);
}

export async function resolveActor(request: Request): Promise<Actor | null> {
  try {
    // Integrations call with `Authorization: Bearer b1_…` (Configuration › API Configuration).
    if (request.headers.get("authorization")) return await resolveTokenActor(request.headers.get("authorization"), request.method);

    const token = await getAuthCookie();
    if (!token) return null;

    const payload = await verifyToken(token);

    const session = await db().userSession.findUnique({ where: { jti: payload.jti } });
    if (!session || session.expiresAt < new Date()) return null;

    // isMaster is embedded in the JWT at login — no extra DB query needed.
    const isMaster = payload.isMaster;

    return {
      id: payload.sub,
      name: payload.name,
      role: payload.role,
      isMaster,
      permissions: isMaster
        ? new Set<Permission>(ALL_PERMISSIONS)
        : permissionsForRole(payload.role),
      companyScope: "ALL",
    };
  } catch {
    return null;
  }
}

export async function requireActor(
  request: Request,
  permission: Permission,
): Promise<Actor> {
  const actor = await resolveActor(request);
  if (!actor) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  }
  // Master bypasses permission checks entirely.
  if (!actor.isMaster && !actor.permissions.has(permission)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.");
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
