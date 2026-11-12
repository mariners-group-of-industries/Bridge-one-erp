import React, { Suspense } from "react";
import { CreatePurchaseOrderView } from "@/features/purchase/components/CreatePurchaseOrderView";

export const instant = false;

export default function CreatePurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading Purchase Order Form...</div>}>
      <CreatePurchaseOrderView />
    </Suspense>
  );
}

