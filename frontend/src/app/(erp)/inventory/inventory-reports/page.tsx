"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function InventoryReportsPage() {
  return (
    <InventoryPageTemplate
      title="Inventory Reports"
      description="Stock ledger, item aging analysis, reorder levels, slow-moving items, and valuation summaries."
      badge="Reports"
      primaryActionLabel="Generate Report"
      tableColumns={["Report Name", "Module / Scope", "Frequency", "Format", "Last Run", "Access Role", "Action"]}
      sampleRows={[
        {
          name: "Item Stock Ledger & Valuation",
          scope: "All Warehouses",
          freq: "Daily",
          format: "PDF / Excel",
          lastRun: "10/13/2026 08:00",
          role: "Inventory Manager",
          action: "View Report",
        },
        {
          name: "Inventory Aging Analysis (30-60-90+ Days)",
          scope: "Raw & Finished Goods",
          freq: "Weekly",
          format: "Excel",
          lastRun: "10/12/2026 18:30",
          role: "Operations & Audit",
          action: "View Report",
        },
        {
          name: "Low Stock & Reorder Alert List",
          scope: "MRO & Spares",
          freq: "Real-time",
          format: "Interactive",
          lastRun: "10/13/2026 12:15",
          role: "Procurement / Store",
          action: "View Report",
        },
      ]}
    />
  );
}
