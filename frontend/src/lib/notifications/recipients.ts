import { grantsAllow, type PermissionAction } from "@/lib/permissions/registry";
import { resolveGrants } from "@/lib/permissions/resolve";
import { db } from "@/lib/prisma/client";

/**
 * Active ERP users allowed `action` on at least one of the pages, by the same
 * permission groups and overrides as their sign-in. Master accounts are only
 * returned when nobody else qualifies, so a request is never left unseen.
 */
export async function usersAllowed(pages: readonly { featureKey: string; action: PermissionAction }[]): Promise<string[]> {
  const users = await db().user.findMany({
    where: { isActive: true, erpAccess: true, status: { notIn: ["INACTIVE", "SUSPENDED"] } },
    select: {
      id: true,
      isMaster: true,
      permissionGroups: { select: { group: { select: { name: true, status: true, fullAccess: true, entries: true } } } },
      permissionOverrides: { select: { activityKey: true, action: true, effect: true } },
    },
  });
  const allowed = users.filter((u) => {
    if (u.isMaster) return false;
    const grants = resolveGrants(
      u.permissionGroups.map((g) => g.group),
      u.permissionOverrides,
    );
    return pages.some((p) => grantsAllow(grants, p.featureKey, p.action));
  });
  return (allowed.length ? allowed : users.filter((u) => u.isMaster)).map((u) => u.id);
}
