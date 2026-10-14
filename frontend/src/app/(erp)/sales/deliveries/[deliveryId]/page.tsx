import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { DeliveryDetailView } from "@/features/sales/deliveries/components/DeliveryDetailView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function Delivery({ params }: { params: Promise<{ deliveryId: string }> }) {
  return <DeliveryDetailView id={(await params).deliveryId} />;
}

export default function SalesDeliveryDetailPage({ params }: { params: Promise<{ deliveryId: string }> }) {
  // Dynamic params are request-time data under Cache Components: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <Delivery params={params} />
    </Suspense>
  );
}
