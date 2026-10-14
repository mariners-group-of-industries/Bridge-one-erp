import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditDeliveryView } from "@/features/sales/deliveries/components/DeliveryEntryViews";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function EditDelivery({ params }: { params: Promise<{ deliveryId: string }> }) {
  return <EditDeliveryView id={(await params).deliveryId} />;
}

export default function EditSalesDeliveryPage({ params }: { params: Promise<{ deliveryId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditDelivery params={params} />
    </Suspense>
  );
}
