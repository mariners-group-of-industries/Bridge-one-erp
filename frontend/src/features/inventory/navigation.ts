import { Store } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { paths } from "./paths";

export const inventoryDashboard: NavLink = {
  label: "Inventory Dashboard",
  href: paths.dashboard,
  description: "Real-time stock valuation, daily coverage, moving frequencies, and transactions.",
  keywords: ["inventory", "dashboard", "stock", "valuation", "balance", "coverage"],
};

export const transferRequest: NavLink = {
  label: "Transfer Request",
  href: paths.transferRequest,
  description: "Inter-warehouse stock transfer requisitions and approval workflows.",
  keywords: ["transfer request", "requisition", "inter warehouse", "stock transfer"],
};

export const transfer: NavLink = {
  label: "Transfer",
  href: paths.transfer,
  description: "Execute and dispatch stock transfers between locations and stores.",
  keywords: ["transfer", "dispatch", "inter store", "location transfer"],
};

export const storeRequisition: NavLink = {
  label: "Store Requisition",
  href: paths.storeRequisition,
  description: "Departmental store material requisitions and consumption indents.",
  keywords: ["store requisition", "indent", "material demand", "consumption"],
};

export const storeIssue: NavLink = {
  label: "Store Issue",
  href: paths.storeIssue,
  description: "Issue stock against approved requisitions, work orders, or production.",
  keywords: ["store issue", "stock issue", "material issuance", "dispatch"],
};

export const stockAdjustment: NavLink = {
  label: "Stock Update",
  href: paths.stockAdjustment,
  description: "Physical audit reconciliation, write-offs, shrinkage, and corrections.",
  keywords: ["stock update", "stock adjustment", "physical audit", "reconciliation", "variance"],
};

export const gateInOut: NavLink = {
  label: "Gate In Out",
  href: paths.gateInOut,
  description: "Security gate pass management for inward and outward materials.",
  keywords: ["gate pass", "gate in", "gate out", "security", "inward", "outward"],
};

export const itemStockConversion: NavLink = {
  label: "Item Stock Conversion",
  href: paths.itemStockConversion,
  description: "UOM conversions, batch repackaging, and item status alterations.",
  keywords: ["stock conversion", "uom", "repackaging", "batch conversion"],
};

export const inventoryReports: NavLink = {
  label: "Inventory Reports",
  href: paths.inventoryReports,
  description: "Stock ledger, age analysis, reorder levels, and valuation reports.",
  keywords: ["inventory reports", "stock ledger", "aging", "valuation report"],
};

export const transferReport: NavLink = {
  label: "Transfer Report",
  href: paths.transferReport,
  description: "Audit trail of warehouse transfers, transit times, and variances.",
  keywords: ["transfer report", "transit report", "inter warehouse audit"],
};

export const inventoryWorkspace: Workspace = {
  id: "inventory",
  label: "Inventory",
  icon: Store,
  href: paths.dashboard,
  description: "Stock valuation, transfers, requisitions, gate control, and inventory audits.",
  status: "active",
  shortcuts: [inventoryDashboard, transferRequest, transfer, storeRequisition, storeIssue],
  cards: [
    {
      label: "",
      links: [
        inventoryDashboard,
        transferRequest,
        transfer,
        storeRequisition,
        storeIssue,
        stockAdjustment,
        gateInOut,
        itemStockConversion,
        inventoryReports,
        transferReport,
      ],
    },
  ],
};
