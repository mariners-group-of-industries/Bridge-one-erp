"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function StoreRequisitionPage() {
  return (
    <InventoryPageTemplate
      title="Store Requisition"
      description="Departmental indent requests for spare parts, chemicals, packaging, and raw materials."
      badge="Requisitions"
      primaryActionLabel="New Store Requisition"
      tableColumns={["Requisition No", "Date", "Department", "Required Date", "Indentor", "Items Count", "Status"]}
      sampleRows={[
        {
          no: "SR-2026-0312",
          date: "10/13/2026",
          dept: "Maintenance & Engineering",
          reqDate: "10/14/2026",
          indentor: "Engr. Shahriar Kabir",
          count: "6 Items",
          status: "Verified",
        },
        {
          no: "SR-2026-0311",
          date: "10/12/2026",
          dept: "Finishing Section",
          reqDate: "10/13/2026",
          indentor: "Sabbir Hossain",
          count: "2 Items",
          status: "Issued",
        },
      ]}
    />
  );
}
