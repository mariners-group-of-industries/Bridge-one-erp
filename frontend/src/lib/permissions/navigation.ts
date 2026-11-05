import type { NavLink, Workspace } from "@/lib/navigation/types";
import { pathAllowed, type AccessGrants } from "./registry";

/**
 * The menus a user may see: pages they can view, and modules with at least one
 * such page. Planned modules stay (greyed out). Hiding is only a convenience —
 * the server checks every request.
 */
export function visibleWorkspaces(list: readonly Workspace[], grants: AccessGrants | undefined): Workspace[] {
  const keep = (links: readonly NavLink[] | undefined) => links?.filter((link) => pathAllowed(grants, link.href));
  return list.flatMap((workspace) => {
    if (workspace.status !== "active") return [workspace];
    const cards = workspace.cards?.map((card) => ({ ...card, links: keep(card.links) ?? [] })).filter((card) => card.links.length > 0);
    const shortcuts = keep(workspace.shortcuts);
    const sidebarLinks = keep(workspace.sidebarLinks);
    const pages = [...(cards ?? []).flatMap((c) => c.links), ...(shortcuts ?? []), ...(sidebarLinks ?? [])];
    if (pages.length === 0) return [];
    return [{ ...workspace, cards, shortcuts, sidebarLinks: workspace.sidebarLinks ? sidebarLinks : undefined }];
  });
}
