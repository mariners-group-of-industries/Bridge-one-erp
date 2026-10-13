"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function GateInOutPage() {
  return (
    <InventoryPageTemplate
      title="Gate In Out"
      description="Factory security gate pass register for all inbound and outbound consignments."
      badge="Gate Control"
      primaryActionLabel="New Gate Pass"
      tableColumns={["Gate Pass No", "Type", "Date & Time", "Vehicle No", "Driver Name", "Party / Supplier", "Status"]}
      sampleRows={[
        {
          no: "GP-2026-1102",
          type: "Gate In (Material)",
          time: "10/13/2026 14:22",
          vehicle: "DM-UA-18-9941",
          driver: "Mofiz Uddin",
          party: "Meghna Yarn Mills Ltd.",
          status: "Cleared",
        },
        {
          no: "GP-2026-1101",
          type: "Gate Out (Delivery)",
          time: "10/13/2026 11:45",
          vehicle: "DM-DA-14-3321",
          driver: "Kalam Sheikh",
          party: "Apex Spinning & Finishing",
          status: "Dispatched",
        },
      ]}
    />
  );
}
