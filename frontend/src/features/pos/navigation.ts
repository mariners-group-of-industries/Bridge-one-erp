import { Calculator } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths } from "./paths";

export const posDashboard: NavLink = {
  label: "POS Dashboard",
  href: paths.dashboard,
  description: "Point of sale overview, counter sales, payment breakdown, and daily collection.",
  keywords: ["pos", "dashboard", "point of sale", "retail", "counter sales"],
};

export const posTerminal: NavLink = {
  label: "Terminal",
  href: paths.terminal,
  description: "Sell at a counter: pick items, take payment, print the receipt. Stock leaves the counter warehouse.",
  keywords: ["pos terminal", "counter", "sell", "cash sale", "checkout", "receipt"],
};

export const posSetup: NavLink = {
  label: "Setup",
  href: paths.setup,
  description: "Discount & offer, counter setup, sales setup, point redeem OTP, and floor & table setup.",
  keywords: ["pos setup", "discount", "offer", "counter setup", "sales setup", "point redeem", "floor", "table"],
};

export const posRc: NavLink = {
  label: "R&C",
  href: paths.rc,
  description: "Standard recipe & cost control, ingredient purchase master, batch costing, SOP, and menu engineering summary.",
  keywords: ["rc", "r&c", "recipe", "costing", "ingredient master", "menu cost", "marinozz", "pantoa"],
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
  description: "Point of sale operations, counter & offer setup, recipe & costing (R&C), and retail sales reporting.",
  status: "active",
  shortcuts: [posDashboard, posTerminal, posSetup, posRc, posReports],
  cards: [
    {
      label: "",
      links: [posDashboard, posTerminal, posSetup, posRc, posReports],
    },
  ],
};
