import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { OrderDetailView } from "@/features/sales/orders/components/OrderDetailView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function Order({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderDetailView id={(await params).orderId} />;
}

export default function SalesOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  // Dynamic params are request-time data under Cache Components: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <Order params={params} />
    </Suspense>
  );
}
