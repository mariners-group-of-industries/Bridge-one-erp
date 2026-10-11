import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditOrderView } from "@/features/sales/orders/components/OrderFormView";

async function EditOrder({ params }: { params: PageProps<"/sales/orders/[orderId]/edit">["params"] }) {
  return <EditOrderView id={(await params).orderId} />;
}

export default function EditSalesOrderPage({ params }: PageProps<"/sales/orders/[orderId]/edit">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditOrder params={params} />
    </Suspense>
  );
}
