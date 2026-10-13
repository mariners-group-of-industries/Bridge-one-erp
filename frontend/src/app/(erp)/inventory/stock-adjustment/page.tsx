"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function StockAdjustmentPage() {
  return (
    <InventoryPageTemplate
      title="Stock Adjustment"
      description="Record physical inventory count reconciliations, shrinkage, damage, and adjustments."
      badge="Reconciliation"
      primaryActionLabel="New Adjustment Voucher"
      tableColumns={["Adjustment No", "Date", "Warehouse", "Reason", "Variance Value", "Approved By", "Status"]}
      sampleRows={[
        {
          no: "ADJ-2026-0012",
          date: "10/10/2026",
          warehouse: "Central Dyes Store",
          reason: "Physical audit evaporation & spillage",
          variance: "৳-18,450.00",
          approvedBy: "CFO Approval",
          status: "Posted",
        },
      ]}
    />
  );
}
