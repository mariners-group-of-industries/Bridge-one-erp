import React, { Suspense } from "react";
import { CreateRequisitionView } from "@/features/purchase/components/CreateRequisitionView";

export const instant = false;

export default function CreateRequisitionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading Requisition Form...</div>}>
      <CreateRequisitionView />
    </Suspense>
  );
}

