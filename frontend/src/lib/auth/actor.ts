import { AppError } from "@/lib/api/errors";

export type Permission = "configuration:read" | "configuration:write" | "sales:read" | "sales:write" | "sales:approve";

export interface Actor {
  id: string;
  permissions: ReadonlySet<Permission>;
  /** Companies this actor may access. "ALL" is reserved for system administrators. */
  companyScope: "ALL" | readonly string[];
}

const DEV_ACTOR: Actor = {
  id: "dev-bypass",
  permissions: new Set<Permission>(["configuration:read", "configuration:write", "sales:read", "sales:write", "sales:approve"]),
  companyScope: "ALL",
};

/**
 * Resolves the authenticated actor for a request.
 *
 * BLOCKER: the repository has no authentication provider yet. Until one is
 * integrated, this fails closed: every request is rejected unless the explicit
 * development bypass is enabled outside production. Replace the body of this
 * function with real session/token verification before production use.
 */
export async function resolveActor(request: Request): Promise<Actor | null> {
  // Reading request data also marks the route as request-time (not prerendered).
  void request.headers;

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ERP_DEV_AUTH_BYPASS === "true"
  ) {
    return DEV_ACTOR;
  }
  return null;
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
