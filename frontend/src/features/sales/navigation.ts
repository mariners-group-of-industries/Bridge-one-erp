import { ShoppingCart } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths, patterns } from "./paths";

export const salesDashboard: NavLink = {
  label: "Sales Dashboard",
  href: paths.dashboard,
  description: "Sales at a glance: totals, trends and open documents.",
  keywords: ["dashboard", "overview", "summary"],
};

export const salesQuotation: NavLink = {
  label: "Sales Quotation",
  href: paths.quotations,
  description: "Price offers sent to customers.",
  keywords: ["quotation", "quote", "offer", "estimate"],
};

export const salesOrder: NavLink = {
  label: "Sales Order",
  href: paths.orders,
  description: "Confirmed customer orders.",
  keywords: ["order", "so"],
};

export const salesDelivery: NavLink = {
  label: "Sales Delivery",
  href: paths.deliveries,
  description: "Goods delivered against sales orders.",
  keywords: ["delivery", "challan", "dispatch", "shipment"],
};

export const salesReturn: NavLink = {
  label: "Sales Return",
  href: paths.returns,
  description: "Goods returned by customers.",
  keywords: ["return", "credit note"],
};

export const salesCollection: NavLink = {
  label: "Sales Collection",
  href: paths.collections,
  description: "Payments received from customers.",
  keywords: ["collection", "payment", "receipt", "receivable"],
};

export const salesTarget: NavLink = {
  label: "Sales Target",
  href: paths.targets,
  description: "Sales targets by person, team and period.",
  keywords: ["target", "goal", "budget"],
};

export const salesReport: NavLink = {
  label: "Sales Report",
  href: paths.reports,
  description: "Sales registers and summary reports.",
  keywords: ["report", "register"],
};

export const salesAnalytics: NavLink = {
  label: "Sales Analytics",
  href: paths.analytics,
  description: "Sales trends by customer, item and territory.",
  keywords: ["analytics", "analysis", "trend", "chart"],
};

export const salesSetup: NavLink = {
  label: "Sales Setup",
  href: paths.setup,
  description: "Customers, items, sales force, areas, categories and price types.",
  keywords: ["customer", "item", "product", "sales force", "territory", "zone", "route", "price", "master", "setup"],
};

/** Sidebar order: the nine sales pages as listed below. */
export const salesLinks: readonly NavLink[] = [
  salesDashboard,
  salesQuotation,
  salesOrder,
  salesDelivery,
  salesReturn,
  salesCollection,
  salesTarget,
  salesReport,
  salesAnalytics,
  salesSetup,
];

export const salesWorkspace: Workspace = {
  id: "sales",
  label: "Sales",
  icon: ShoppingCart,
  href: paths.workspace,
  description: "Quotations, orders, deliveries, returns, collections, targets and reports.",
  status: "active",
  shortcuts: salesLinks,
  cards: [
    { label: "Transactions", links: [salesQuotation, salesOrder, salesDelivery, salesReturn, salesCollection] },
    { label: "Planning", links: [salesTarget] },
    { label: "Reports & Analytics", links: [salesDashboard, salesReport, salesAnalytics] },
    { label: "Setup", links: [salesSetup] },
  ],
  routes: [
    { pattern: patterns.newQuotation, label: "New Sales Quotation", parent: paths.quotations },
    { pattern: patterns.quotation, label: "Quotation", parent: paths.quotations },
    { pattern: patterns.newOrder, label: "Create Sales Order", parent: paths.orders },
    { pattern: patterns.editOrder, label: "Edit", parent: paths.orders },
    { pattern: patterns.order, label: "Order", parent: paths.orders },
  ],
};
