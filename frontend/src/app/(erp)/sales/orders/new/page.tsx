"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewOrderView } from "@/features/sales/orders/components/OrderFormView";

function NewOrder() {
  return <NewOrderView quotationId={useSearchParams().get("quotation")} />;
}

/** /sales/orders/new[?quotation=<quotationId>] */
export default function NewSalesOrderPage() {
  // Search params are request-time data: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <NewOrder />
    </Suspense>
  );
}
