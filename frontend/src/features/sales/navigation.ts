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
  description: "Goods returned by customers: full, partial, without reference and market returns.",
  keywords: ["return", "credit note", "market return", "damaged", "expired"],
};

export const salesCollection: NavLink = {
  label: "Sales Collection",
  href: paths.collections,
  description: "Dues, bills, collections by invoice and advances from customers.",
  keywords: ["collection", "payment", "receipt", "receivable"],
};

export const salesTarget: NavLink = {
  label: "Sales Target",
  href: paths.targets,
  description: "Targets by sales force and month, campaign targets with commission, and item commissions.",
  keywords: ["target", "goal", "budget", "commission", "incentive"],
};

/** Sales Report and Sales Analytics on one page (two tabs). */
export const salesReportAnalytics: NavLink = {
  label: "Sales Report & Analytics",
  href: paths.reports,
  description: "Sales registers and summary reports, and sales trends by customer, item and territory.",
  keywords: ["report", "register", "analytics", "analysis", "trend", "chart"],
};

/** Sidebar order: the sales pages as listed below. */
export const salesLinks: readonly NavLink[] = [
  salesDashboard,
  salesQuotation,
  salesOrder,
  salesDelivery,
  salesReturn,
  salesCollection,
  salesTarget,
  salesReportAnalytics,
];

export const salesWorkspace: Workspace = {
  id: "sales",
  label: "Sales",
  icon: ShoppingCart,
  href: paths.workspace,
  description: "Quotations, orders, deliveries, returns, collections, targets and reports.",
  status: "active",
  shortcuts: salesLinks,
  // Flat list in the sidebar, as in Managerium.
  sidebarLinks: salesLinks,
  cards: [
    { label: "Transactions", links: [salesQuotation, salesOrder, salesDelivery, salesReturn, salesCollection] },
    { label: "Planning", links: [salesTarget] },
    { label: "Reports & Analytics", links: [salesDashboard, salesReportAnalytics] },
  ],
  routes: [
    { pattern: patterns.newQuotation, label: "Create Sales Quotation", parent: paths.quotations },
    { pattern: patterns.editQuotation, label: "Edit Sales Quotation", parent: paths.quotations },
    { pattern: patterns.quotation, label: "Quotation", parent: paths.quotations },
    { pattern: patterns.newOrder, label: "Create Sales Order", parent: paths.orders },
    { pattern: patterns.editOrder, label: "Edit", parent: paths.orders },
    { pattern: patterns.order, label: "Order", parent: paths.orders },
    { pattern: patterns.newDelivery, label: "New Delivery", parent: paths.deliveries },
    { pattern: patterns.exchange, label: "Exchange", parent: paths.deliveries },
    { pattern: patterns.editDelivery, label: "Edit Delivery", parent: paths.deliveries },
    { pattern: patterns.deliveryChallan, label: "Challan Details", parent: paths.deliveries },
    { pattern: patterns.delivery, label: "Delivery Details", parent: paths.deliveries },
    { pattern: patterns.newReturn, label: "New Return", parent: paths.returns },
    { pattern: patterns.editReturn, label: "Edit Return", parent: paths.returns },
    { pattern: patterns.salesReturn, label: "Return Details", parent: paths.returns },
    { pattern: patterns.collectByInvoice, label: "Due Collection", parent: paths.collections },
    { pattern: patterns.newAdvance, label: "Advance Collection", parent: paths.collections },
    { pattern: patterns.newBill, label: "Bill Create", parent: paths.collections },
    { pattern: patterns.bill, label: "Bill", parent: paths.collections },
    { pattern: patterns.collection, label: "Money Receipt", parent: paths.collections },
    { pattern: patterns.newBudget, label: "Create Target", parent: paths.targets },
    { pattern: patterns.editBudget, label: "Edit Target", parent: paths.targets },
    { pattern: patterns.newPlan, label: "Create Sales Target", parent: paths.targets },
    { pattern: patterns.editPlan, label: "Edit Sales Target", parent: paths.targets },
    { pattern: patterns.plan, label: "Sales Target", parent: paths.targets },
    { pattern: patterns.assignPlan, label: "Assign Sales Force", parent: paths.targets },
    { pattern: patterns.newCommission, label: "Create Commission Setup", parent: paths.targets },
    { pattern: patterns.editCommission, label: "Edit Commission Setup", parent: paths.targets },
  ],
};
