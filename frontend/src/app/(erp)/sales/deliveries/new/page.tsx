import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewDeliveryView } from "@/features/sales/deliveries/components/DeliveryEntryViews";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "New Sales Delivery" };

/** /sales/deliveries/new[?order=<salesOrderId>]: delivery for an order, else a direct delivery. */
export default function NewSalesDeliveryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewDeliveryView />
    </Suspense>
  );
}
