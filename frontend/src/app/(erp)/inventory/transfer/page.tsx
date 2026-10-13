"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function TransferPage() {
  return (
    <InventoryPageTemplate
      title="Transfer"
      description="Stock dispatch and physical delivery receipts between warehouse locations."
      badge="Stock Movement"
      primaryActionLabel="New Stock Transfer"
      tableColumns={["Transfer No", "Date", "Transfer Req Ref", "From Location", "To Location", "Vehicle No", "Status"]}
      sampleRows={[
        {
          no: "TRN-2026-0045",
          date: "10/12/2026",
          ref: "TR-2026-0089",
          from: "Central RM Warehouse",
          to: "Spinning Unit 1 Store",
          vehicle: "DM-TA-11-2094",
          status: "In Transit",
        },
      ]}
    />
  );
}
