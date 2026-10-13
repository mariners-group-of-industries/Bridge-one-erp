"use client";

import React from "react";
import { InventoryPageTemplate } from "@/features/inventory/components/InventoryPageTemplate";

export default function ItemStockConversionPage() {
  return (
    <InventoryPageTemplate
      title="Item Stock Conversion"
      description="Repackaging, conversion between units of measure (UOM), and grade categorization."
      badge="Conversions"
      primaryActionLabel="New Stock Conversion"
      tableColumns={["Conversion No", "Date", "Source Item", "Source Qty", "Target Item", "Target Qty", "Status"]}
      sampleRows={[
        {
          no: "CVN-2026-0034",
          date: "10/09/2026",
          source: "Liquid Caustic Soda 50% (Bulk)",
          sourceQty: "5,000 Liters",
          target: "Diluted Caustic Soda 30%",
          targetQty: "8,330 Liters",
          status: "Processed",
        },
      ]}
    />
  );
}
