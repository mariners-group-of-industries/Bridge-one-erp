import React, { Suspense } from "react";
import { DirectReceiveView } from "@/features/purchase/components/DirectReceiveView";

export const instant = false;

export default function DirectReceivePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading Direct Receive Form...</div>}>
      <DirectReceiveView />
    </Suspense>
  );
}

