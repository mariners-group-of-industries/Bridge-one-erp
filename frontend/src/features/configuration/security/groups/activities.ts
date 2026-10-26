import { workspaces } from "@/lib/navigation/registry";

/** A row of the permission matrix: one page of the menus. */
export interface PermissionActivity {
  /** Stable key: the page path. */
  key: string;
  moduleName: string;
  activityName: string;
}

/**
 * Every page of the built (non-planned) modules, in menu order: shortcuts, then
 * the cards' links, then flat sidebar links. Pages listed twice appear once.
 */
export function permissionActivities(): PermissionActivity[] {
  const seen = new Set<string>();
  const rows: PermissionActivity[] = [];
  for (const workspace of workspaces) {
    if (workspace.status !== "active") continue;
    const links = [...(workspace.shortcuts ?? []), ...(workspace.cards ?? []).flatMap((card) => card.links), ...(workspace.sidebarLinks ?? [])];
    for (const link of links) {
      if (seen.has(link.href)) continue;
      seen.add(link.href);
      rows.push({ key: link.href, moduleName: workspace.label, activityName: link.label });
    }
  }
  return rows;
}
