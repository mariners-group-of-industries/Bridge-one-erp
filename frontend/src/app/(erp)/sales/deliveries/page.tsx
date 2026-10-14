import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { DeliveryWorkspaceView } from "@/features/sales/deliveries/components/DeliveryWorkspaceView";
import { salesDelivery } from "@/features/sales/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesDelivery.label };

/** /sales/deliveries?tab=approved|deliveries|exchanges|challans */
export default function SalesDeliveryPage() {
  // The tab lives in the search params (request-time data): read it inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <DeliveryWorkspaceView />
    </Suspense>
  );
}
