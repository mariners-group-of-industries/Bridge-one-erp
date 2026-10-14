import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { DeliveryPrintView, type PrintDoc } from "@/features/sales/deliveries/components/DeliveryPrintView";

export const metadata: Metadata = { title: "Print Delivery" };

const DOCS: readonly PrintDoc[] = ["challan", "challan-plain", "mushak", "invoice"];

async function PrintDelivery({
  params,
  searchParams,
}: {
  params: Promise<{ deliveryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ deliveryId }, query] = await Promise.all([params, searchParams]);
  const doc = DOCS.find((candidate) => candidate === query.doc) ?? "challan";
  return <DeliveryPrintView id={deliveryId} doc={doc} />;
}

/** /print/sales/deliveries/:id?doc=challan|challan-plain|mushak|invoice — outside the desk shell. */
export default function PrintSalesDeliveryPage(props: {
  params: Promise<{ deliveryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PrintDelivery params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
