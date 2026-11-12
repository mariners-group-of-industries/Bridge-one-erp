import React, { Suspense } from "react";
import { CreateReturnWithoutRefView } from "@/features/purchase/components/CreateReturnWithoutRefView";

export const instant = false;

export default function CreateReturnPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading Purchase Return Form...</div>}>
      <CreateReturnWithoutRefView />
    </Suspense>
  );
}

