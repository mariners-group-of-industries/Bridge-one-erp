import { ShoppingBag } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";

export const purchaseDashboard: NavLink = {
  label: "Purchase Dashboard",
  href: "/purchase",
  description: "Key procurement metrics, recent activities and spend analytics.",
  keywords: ["purchase", "dashboard", "kpi", "spend", "metrics"],
};

export const purchaseRequisitions: NavLink = {
  label: "Purchase Requisition",
  href: "/purchase/requisitions",
  description: "Internal department purchase demands and requisition approvals.",
  keywords: ["requisition", "demand", "pr", "approval"],
};

export const purchaseOrders: NavLink = {
  label: "Purchase Order",
  href: "/purchase/orders",
  description: "Official purchase orders issued to verified vendors and suppliers.",
  keywords: ["purchase order", "po", "procurement", "vendor"],
};

export const purchaseReceive: NavLink = {
  label: "Purchase Receive",
  href: "/purchase/receive",
  description: "Goods receipt notes (GRN), shipment inspection and warehouse acceptance.",
  keywords: ["receive", "receipt", "grn", "warehouse", "delivery"],
};

export const purchaseReturns: NavLink = {
  label: "Purchase Return",
  href: "/purchase/returns",
  description: "Debit notes and goods return shipments back to vendors.",
  keywords: ["return", "debit note", "vendor return", "rma"],
};

export const supplierPayments: NavLink = {
  label: "Supplier Payment",
  href: "/purchase/supplier-payments",
  description: "Vendor settlement, bills, payment vouchers and ledger balance analysis.",
  keywords: ["payment", "supplier", "vendor", "bill", "voucher", "settlement"],
};

export const purchaseAnalytics: NavLink = {
  label: "Purchase Analytics",
  href: "/purchase/analytics",
  description: "Procurement trends, vendor performance and cost breakdown charts.",
  keywords: ["analytics", "charts", "trends", "spend breakdown", "metrics"],
};

export const purchaseReports: NavLink = {
  label: "Purchase Report",
  href: "/purchase/reports",
  description: "Item-wise, supplier-wise and monthly procurement register exports.",
  keywords: ["report", "register", "excel", "pdf", "export"],
};

export const purchaseWorkspace: Workspace = {
  id: "purchase",
  label: "Purchase",
  icon: ShoppingBag,
  href: "/purchase",
  description: "Requisitions, purchase orders, goods receipts, returns and supplier settlements.",
  status: "active",
  shortcuts: [
    purchaseDashboard,
    purchaseRequisitions,
    purchaseOrders,
    purchaseReceive,
    supplierPayments,
  ],
  cards: [
    {
      label: "",
      links: [
        purchaseDashboard,
        purchaseRequisitions,
        purchaseOrders,
        purchaseReceive,
        purchaseReturns,
        supplierPayments,
        purchaseAnalytics,
        purchaseReports,
      ],
    },
  ],
  routes: [
    { pattern: "/purchase/requisitions/create", label: "Create Requisition", parent: purchaseRequisitions.href },
    { pattern: "/purchase/requisitions/[requisitionId]", label: "Requisition", parent: purchaseRequisitions.href },
    { pattern: "/purchase/orders/create", label: "Create Purchase Order", parent: purchaseOrders.href },
    { pattern: "/purchase/orders/[orderId]", label: "Purchase Order", parent: purchaseOrders.href },
    { pattern: "/purchase/receive/create", label: "Direct Receive", parent: purchaseReceive.href },
    { pattern: "/purchase/returns/create", label: "Create Return Without Ref.", parent: purchaseReturns.href },
    { pattern: "/purchase/supplier-payments/payment-by-grn", label: "Payment By GRN", parent: supplierPayments.href },
  ],
};
