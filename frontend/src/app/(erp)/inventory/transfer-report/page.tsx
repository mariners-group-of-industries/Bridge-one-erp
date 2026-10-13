"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function TransferReportPage() {
  return (
    <InventoryPageTemplate
      title="Transfer Report"
      description="Detailed historical logs of all warehouse transfers, transit variances, and receipt status."
      badge="Transfer Auditing"
      primaryActionLabel="Run Audit Report"
      tableColumns={["Transfer Date", "Transfer No", "Origin", "Destination", "Item / Quantity", "Transit Time", "Status"]}
      sampleRows={[
        {
          date: "10/12/2026",
          no: "TRN-2026-0045",
          from: "Central RM Warehouse",
          to: "Spinning Unit 1 Store",
          items: "Cotton Yarn 30/1 (150 Bales)",
          time: "2.4 Hours",
          status: "Completed",
        },
        {
          date: "10/11/2026",
          no: "TRN-2026-0044",
          from: "Central Dyes Store",
          to: "Dyeing Plant Store",
          items: "Reactive Dyes (450 Kg)",
          time: "1.2 Hours",
          status: "Completed",
        },
      ]}
    />
  );
}
