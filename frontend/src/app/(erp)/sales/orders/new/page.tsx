import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewOrderView } from "@/features/sales/orders/components/OrderFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "New Sales Order" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function NewOrder({ searchParams }: { searchParams: SearchParams }) {
  const { quotation } = await searchParams;
  return <NewOrderView quotationId={typeof quotation === "string" ? quotation : null} />;
}

/** /sales/orders/new[?quotation=<quotationId>] */
export default function NewSalesOrderPage({ searchParams }: { searchParams: SearchParams }) {
  // Search params are request-time data: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <NewOrder searchParams={searchParams} />
    </Suspense>
  );
}
