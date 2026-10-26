import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { OrderDetailView } from "@/features/production/orders/components/OrderDetailView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Production Order View" };

async function OrderDetail({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderDetailView id={(await params).orderId} />;
}

export default function ProductionOrderViewPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}
