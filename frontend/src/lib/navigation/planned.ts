import { Boxes, Calculator, ShoppingBag, Users } from "lucide-react";
import type { Workspace } from "./types";

/**
 * Modules on the roadmap. They appear greyed-out in the sidebar. When you start
 * one, move its entry into `src/features/<module>/navigation.ts`, set
 * `status: "active"` and register it in `registry.ts`.
 */
export const plannedWorkspaces: Workspace[] = [
  {
    id: "buying",
    label: "Buying",
    icon: ShoppingBag,
    href: "/buying",
    description: "Suppliers, requests for quotation, purchase orders and receipts.",
    status: "planned",
  },
  {
    id: "stock",
    label: "Stock",
    icon: Boxes,
    href: "/stock",
    description: "Items, stock levels and stock movements.",
    status: "planned",
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: Calculator,
    href: "/accounting",
    description: "Chart of accounts, invoices, payments and ledgers.",
    status: "planned",
  },
  {
    id: "hr",
    label: "HR",
    icon: Users,
    href: "/hr",
    description: "Employees, attendance, leave and payroll.",
    status: "planned",
  },
];
