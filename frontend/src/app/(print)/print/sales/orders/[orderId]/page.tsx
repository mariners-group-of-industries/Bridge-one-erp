import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { OrderPrintView } from "@/features/sales/orders/components/OrderPrintView";

export const metadata: Metadata = { title: "Print Sales Order" };

async function PrintOrder({ params }: { params: PageProps<"/print/sales/orders/[orderId]">["params"] }) {
  return <OrderPrintView id={(await params).orderId} />;
}

/** Printable sales order, outside the desk shell (no navbar or sidebar on paper). */
export default function PrintSalesOrderPage({ params }: PageProps<"/print/sales/orders/[orderId]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PrintOrder params={params} />
    </Suspense>
  );
}
