import { ACTION_COLUMNS, allPermissionKeys, permissionFeatures, permissionKey, PERMISSION_ACTIONS, type AccessGrants, type PermissionAction } from "./registry";

/**
 * Effective permissions, in priority order:
 *   1. the master account (handled by the caller: it has everything),
 *   2. an explicit user Deny,
 *   3. an explicit user Allow,
 *   4. the union of the user's ACTIVE groups (a full-access group grants everything),
 *   5. otherwise denied.
 */

type EntryColumns = { [K in (typeof ACTION_COLUMNS)[PermissionAction]]: boolean };

export interface GroupGrants {
  id?: string;
  name?: string;
  status: "ACTIVE" | "INACTIVE";
  fullAccess: boolean;
  entries: ({ activityKey: string } & EntryColumns)[];
}

export interface OverrideRow {
  activityKey: string;
  action: string;
  effect: "ALLOW" | "DENY";
}

export type PermissionSource = "group" | "allow" | "deny" | "none";

export interface EffectivePermission {
  key: string;
  featureKey: string;
  action: PermissionAction;
  granted: boolean;
  source: PermissionSource;
  /** Active groups that grant it (also listed when a Deny overrides them). */
  groups: string[];
}

/** A group in the same shape as its stored matrix rows, from granted actions per page (for previews). */
export function groupFromGrants(group: { name: string; status: "ACTIVE" | "INACTIVE"; fullAccess: boolean; grants: Record<string, readonly PermissionAction[]> }): GroupGrants {
  return {
    name: group.name,
    status: group.status,
    fullAccess: group.fullAccess,
    entries: Object.entries(group.grants).map(([activityKey, actions]) => ({
      activityKey,
      ...(Object.fromEntries(PERMISSION_ACTIONS.map((a) => [ACTION_COLUMNS[a], actions.includes(a)])) as EntryColumns),
    })),
  };
}

/** Permission keys each active group grants. */
function groupKeys(group: GroupGrants): Set<string> {
  if (group.status !== "ACTIVE") return new Set();
  if (group.fullAccess) return new Set(allPermissionKeys());
  const keys = new Set<string>();
  for (const entry of group.entries) {
    for (const action of PERMISSION_ACTIONS) if (entry[ACTION_COLUMNS[action]]) keys.add(permissionKey(entry.activityKey, action));
  }
  return keys;
}

const isAction = (value: string): value is PermissionAction => (PERMISSION_ACTIONS as readonly string[]).includes(value);

/** The grants a non-master user holds from their groups and overrides. */
export function resolveGrants(groups: GroupGrants[], overrides: OverrideRow[]): AccessGrants {
  const keys = new Set<string>();
  for (const group of groups) for (const key of groupKeys(group)) keys.add(key);
  for (const o of overrides) {
    if (!isAction(o.action)) continue;
    const key = permissionKey(o.activityKey, o.action);
    if (o.effect === "ALLOW") keys.add(key);
  }
  // Deny wins over Allow and over every group.
  for (const o of overrides) if (o.effect === "DENY" && isAction(o.action)) keys.delete(permissionKey(o.activityKey, o.action));
  return { all: false, keys };
}

/** Every registry permission with whether it is granted and why (for the Effective Permissions view). */
export function explainPermissions(groups: GroupGrants[], overrides: OverrideRow[]): EffectivePermission[] {
  const perGroup = groups.map((g) => ({ name: g.name ?? "Group", keys: groupKeys(g) }));
  const override = new Map(overrides.filter((o) => isAction(o.action)).map((o) => [permissionKey(o.activityKey, o.action as PermissionAction), o.effect]));
  return permissionFeatures().flatMap((f) =>
    f.actions.map((action) => {
      const key = permissionKey(f.key, action);
      const granting = perGroup.filter((g) => g.keys.has(key)).map((g) => g.name);
      const effect = override.get(key);
      const source: PermissionSource = effect === "DENY" ? "deny" : effect === "ALLOW" ? "allow" : granting.length ? "group" : "none";
      return { key, featureKey: f.key, action, granted: source === "allow" || source === "group", source, groups: granting };
    }),
  );
}
