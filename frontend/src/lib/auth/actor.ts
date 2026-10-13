import { AppError } from "@/lib/api/errors";
import { getAuthCookie } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
import { db } from "@/lib/prisma/client";

export type Permission =
  | "configuration:read"
  | "configuration:write"
  | "sales:read"
  | "sales:write"
  | "sales:approve"
  | "accounts:read"
  | "accounts:write";

export interface Actor {
  id: string;
  role: string;
  permissions: ReadonlySet<Permission>;
  /** Companies this actor may access. "ALL" is reserved for system administrators. */
  companyScope: "ALL" | readonly string[];
}

const ALL_PERMISSIONS: Permission[] = [
  "configuration:read",
  "configuration:write",
  "sales:read",
  "sales:write",
  "sales:approve",
  "accounts:read",
  "accounts:write",
];

function permissionsForRole(role: string): ReadonlySet<Permission> {
  // ADMINISTRATOR gets all permissions; extend this as roles grow.
  return new Set<Permission>(ALL_PERMISSIONS);
}

export async function resolveActor(_request: Request): Promise<Actor | null> {
  try {
    const token = await getAuthCookie();
    if (!token) return null;

    const payload = await verifyToken(token);

    // Check session not revoked
    const session = await db().userSession.findUnique({ where: { jti: payload.jti } });
    if (!session || session.expiresAt < new Date()) return null;

    return {
      id: payload.sub,
      role: payload.role,
      permissions: permissionsForRole(payload.role),
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
  if (!actor.permissions.has(permission)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
  return actor;
}

export function canAccessCompany(actor: Actor, companyId: string): boolean {
  return actor.companyScope === "ALL" || actor.companyScope.includes(companyId);
}

/**
 * Throws NOT_FOUND (not FORBIDDEN) so that resources belonging to other
 * companies are indistinguishable from missing ones.
 */
export function assertCompanyAccess(actor: Actor, companyId: string, entity: string): void {
  if (!canAccessCompany(actor, companyId)) {
    throw new AppError(404, "NOT_FOUND", `${entity} not found.`);
  }
}
