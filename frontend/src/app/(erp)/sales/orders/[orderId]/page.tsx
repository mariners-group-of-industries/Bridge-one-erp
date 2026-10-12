import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { OrderDetailView } from "@/features/sales/orders/components/OrderDetailView";

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
