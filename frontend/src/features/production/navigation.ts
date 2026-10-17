import { Factory } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths, patterns } from "./paths";

export const productionDashboard: NavLink = {
  label: "Production Dashboard",
  href: paths.dashboard,
  description: "Production volume, productivity and the top items and machines.",
  keywords: ["production", "dashboard", "output", "productivity", "machine"],
};

export const workCenter: NavLink = {
  label: "Work Center",
  href: paths.workCenters,
  description: "Machines and lines where items are produced.",
  keywords: ["work center", "machine", "line", "capacity"],
};

export const billOfMaterial: NavLink = {
  label: "Bill Of Material",
  href: paths.billOfMaterials,
  description: "Raw materials and quantities needed to produce an item.",
  keywords: ["bom", "bill of material", "recipe", "raw material"],
};

export const productionOrder: NavLink = {
  label: "Production Order",
  href: paths.orders,
  description: "Planned production of items on work centers.",
  keywords: ["production order", "work order", "plan"],
};

export const productionEntry: NavLink = {
  label: "Production Entry",
  href: paths.entries,
  description: "Output recorded per item, work center and shift.",
  keywords: ["production entry", "output", "shift", "produced"],
};

export const productionReport: NavLink = {
  label: "Production Report",
  href: paths.reports,
  description: "Production by item, work center and period.",
  keywords: ["production report", "output report"],
};

/** Sidebar order, as in Managerium. */
export const productionLinks: readonly NavLink[] = [productionDashboard, workCenter, billOfMaterial, productionOrder, productionEntry, productionReport];

export const productionWorkspace: Workspace = {
  id: "production",
  label: "Production",
  icon: Factory,
  href: paths.workspace,
  description: "Work centers, bills of material, production orders and output.",
  status: "active",
  shortcuts: productionLinks,
  sidebarLinks: productionLinks,
  routes: [
    { pattern: patterns.newWorkCenter, label: "New Work Center", parent: paths.workCenters },
    { pattern: patterns.editWorkCenter, label: "Edit Work Center", parent: paths.workCenters },
  ],
  cards: [
    { label: "Planning", links: [workCenter, billOfMaterial, productionOrder] },
    { label: "Execution", links: [productionEntry] },
    { label: "Reports", links: [productionDashboard, productionReport] },
  ],
};
