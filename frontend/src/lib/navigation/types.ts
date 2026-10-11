import type { LucideIcon } from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
  description?: string;
  /** Extra search terms for the awesomebar. */
  keywords?: readonly string[];
}

/** A titled group of links, shown as a card on the workspace page. */
export interface NavCard {
  label: string;
  links: readonly NavLink[];
}

/**
 * Page that is not linked from the menu (e.g. a record form), registered so the
 * navbar can show breadcrumbs. `pattern` uses Next.js segment syntax:
 * "/configuration/business-config/offices/[officeId]".
 */
export interface NavRoute {
  pattern: string;
  label: string;
  /** href of the page this one belongs to (usually the list view). */
  parent?: string;
}

/** An ERPNext-style workspace: one per module, listed in the sidebar. */
export interface Workspace {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  description: string;
  /** "planned" modules are shown greyed-out in the sidebar until they are built. */
  status: "active" | "planned";
  shortcuts?: readonly NavLink[];
  cards?: readonly NavCard[];
  routes?: readonly NavRoute[];
}

export interface Breadcrumb {
  label: string;
  href: string;
}
