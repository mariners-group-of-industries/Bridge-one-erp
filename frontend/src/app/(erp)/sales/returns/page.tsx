import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { salesReturn } from "@/features/sales/navigation";
import { ReturnWorkspaceView } from "@/features/sales/returns/components/ReturnWorkspaceView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesReturn.label };

/** /sales/returns?tab=deliveries|returns|market */
export default function SalesReturnPage() {
  // The tab lives in the search params (request-time data): read it inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <ReturnWorkspaceView />
    </Suspense>
  );
}
