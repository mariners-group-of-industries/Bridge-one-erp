import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditOrderView } from "@/features/sales/orders/components/OrderFormView";

async function EditOrder({ params }: { params: Promise<{ orderId: string }> }) {
  return <EditOrderView id={(await params).orderId} />;
}

export default function EditSalesOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditOrder params={params} />
    </Suspense>
  );
}
