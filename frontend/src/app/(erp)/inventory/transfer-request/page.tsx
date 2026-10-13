"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function TransferRequestPage() {
  return (
    <InventoryPageTemplate
      title="Transfer Request"
      description="Manage inter-warehouse stock transfer requests and requisitions."
      badge="Transfers"
      primaryActionLabel="New Transfer Request"
      tableColumns={["Request No", "Date", "Source Store", "Destination Store", "Requested By", "Status", "Total Qty"]}
      sampleRows={[
        {
          no: "TR-2026-0089",
          date: "10/12/2026",
          source: "Central RM Warehouse",
          dest: "Spinning Unit 1 Store",
          requestedBy: "Md. Rafiqul Islam",
          status: "Approved",
          qty: "150 Bales",
        },
        {
          no: "TR-2026-0088",
          date: "10/11/2026",
          source: "Central Dyes Store",
          dest: "Dyeing Plant Store",
          requestedBy: "Tanvir Ahmed",
          status: "Pending Approval",
          qty: "450 Kg",
        },
      ]}
    />
  );
}
