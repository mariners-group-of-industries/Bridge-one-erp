import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditOrderView } from "@/features/production/orders/components/OrderFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Edit Production Order" };

async function EditOrder({ params }: { params: Promise<{ orderId: string }> }) {
  return <EditOrderView id={(await params).orderId} />;
}

export default function EditProductionOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditOrder params={params} />
    </Suspense>
  );
}
