import { accountWorkspace } from "@/features/accounts/navigation";
import { configurationWorkspace } from "@/features/configuration/navigation";
import { hrmWorkspace } from "@/features/hrm/navigation";
import { inventoryWorkspace } from "@/features/inventory/navigation";
import { productionWorkspace } from "@/features/production/navigation";
import { purchaseWorkspace } from "@/features/purchase/navigation";
import { salesWorkspace } from "@/features/sales/navigation";
import { crmWorkspace, rtmWorkspace } from "./planned";
import type { Breadcrumb, NavLink, NavRoute, Workspace } from "./types";

/**
 * Every module's workspace, in sidebar order. Each module owns its definition in
 * `src/features/<module>/navigation.ts`; adding a module is one import + one
 * entry here.
 */
export const workspaces: readonly Workspace[] = [
  purchaseWorkspace,
  inventoryWorkspace,
  productionWorkspace,
  salesWorkspace,
  accountWorkspace,
  hrmWorkspace,
  configurationWorkspace,
  rtmWorkspace,
  crmWorkspace,
];

export interface SearchEntry extends NavLink {
  group: string;
}

/** Everything the awesomebar can jump to: workspaces and their pages (deduplicated). */
export function searchEntries(list: readonly Workspace[] = workspaces): SearchEntry[] {
  const entries = new Map<string, SearchEntry>();
  entries.set("/", { label: "Home", href: "/", group: "Workspaces", description: "All modules" });
  for (const workspace of list) {
    if (workspace.status !== "active") continue;
    entries.set(workspace.href, {
      label: workspace.label,
      href: workspace.href,
      description: workspace.description,
      group: "Workspaces",
    });
    for (const link of workspaceLinks(workspace)) {
      if (!entries.has(link.href)) entries.set(link.href, { ...link, group: workspace.label });
    }
  }
  return [...entries.values()];
}

export function workspaceLinks(workspace: Workspace): NavLink[] {
  return [...(workspace.shortcuts ?? []), ...(workspace.cards ?? []).flatMap((card) => card.links)];
}

/** Workspace that owns `pathname` ("/" belongs to none). */
export function findWorkspace(pathname: string, list: readonly Workspace[] = workspaces): Workspace | undefined {
  return list.find(
    (workspace) => workspace.status === "active" && (pathname === workspace.href || pathname.startsWith(`${workspace.href}/`)),
  );
}

/** True when `pathname` matches a pattern with [param] segments. */
export function matchesPattern(pattern: string, pathname: string): boolean {
  const expected = pattern.split("/").filter(Boolean);
  const actual = pathname.split("/").filter(Boolean);
  return (
    expected.length === actual.length &&
    expected.every((segment, index) => /^\[.+\]$/.test(segment) || segment === actual[index])
  );
}

/** Breadcrumbs for the navbar: Workspace › (group ›) (list page ›) current page. */
export function resolveBreadcrumbs(pathname: string, list: readonly Workspace[] = workspaces): Breadcrumb[] {
  const workspace = findWorkspace(pathname, list);
  if (!workspace) return [];

  const crumbs: Breadcrumb[] = [{ label: workspace.label, href: workspace.href }];
  if (pathname === workspace.href) return crumbs;

  // Groups with their own landing page (e.g. Entity Master Data) get a crumb.
  for (const card of workspace.cards ?? []) {
    if (!card.href) continue;
    const cardCrumb = { label: card.label, href: card.href };
    if (pathname === card.href) return [...crumbs, cardCrumb];
    const cardLink = card.links.find((item) => item.href === pathname);
    if (cardLink) return [...crumbs, cardCrumb, { label: cardLink.label, href: cardLink.href }];
  }

  const links = workspaceLinks(workspace);
  const link = links.find((item) => item.href === pathname);
  if (link) return [...crumbs, { label: link.label, href: link.href }];

  const route: NavRoute | undefined = workspace.routes?.find((item) => matchesPattern(item.pattern, pathname));
  if (!route) return crumbs;
  const parent = route.parent ? links.find((item) => item.href === route.parent) : undefined;
  return [...crumbs, ...(parent ? [{ label: parent.label, href: parent.href }] : []), { label: route.label, href: pathname }];
}
