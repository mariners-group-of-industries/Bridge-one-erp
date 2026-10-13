"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function StoreIssuePage() {
  return (
    <InventoryPageTemplate
      title="Store Issue"
      description="Issue materials from inventory stores against verified requisitions or work orders."
      badge="Store Issuance"
      primaryActionLabel="New Store Issue"
      tableColumns={["Issue Slip No", "Date", "Requisition Ref", "Department", "Store Keeper", "Issue Value", "Status"]}
      sampleRows={[
        {
          no: "ISS-2026-0544",
          date: "10/13/2026",
          ref: "SR-2026-0311",
          dept: "Finishing Section",
          keeper: "Kamrul Hasan",
          val: "৳145,200.00",
          status: "Completed",
        },
      ]}
    />
  );
}
