import { Calculator } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths } from "./paths";

export const posDashboard: NavLink = {
  label: "POS Dashboard",
  href: paths.dashboard,
  description: "Point of sale overview, counter sales, payment breakdown, and daily collection.",
  keywords: ["pos", "dashboard", "point of sale", "retail", "counter sales"],
};

export const posSetup: NavLink = {
  label: "Setup",
  href: paths.setup,
  description: "Discount & offer, counter setup, sales setup, point redeem OTP, and floor & table setup.",
  keywords: ["pos setup", "discount", "offer", "counter setup", "sales setup", "point redeem", "floor", "table"],
};

export const posReports: NavLink = {
  label: "Reports",
  href: paths.reports,
  description: "Inventory report, POS sales report, VAT report, discount report, data log report, and MIS report.",
  keywords: ["pos reports", "inventory report", "pos sales report", "vat report", "discount report", "data log", "mis report"],
};

export const posWorkspace: Workspace = {
  id: "pos",
  label: "POS",
  icon: Calculator,
  href: paths.dashboard,
  description: "Point of sale operations, counter & offer setup, and retail sales reporting.",
  status: "active",
  shortcuts: [posDashboard, posSetup, posReports],
  cards: [
    {
      label: "",
      links: [posDashboard, posSetup, posReports],
    },
  ],
};

