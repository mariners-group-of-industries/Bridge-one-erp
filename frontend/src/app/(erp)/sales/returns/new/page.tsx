import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewReturnView } from "@/features/sales/returns/components/ReturnFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "New Sales Return" };

/** /sales/returns/new[?delivery=<deliveryId>&mode=full|partial]: return of a delivery, else without reference. */
export default function NewSalesReturnPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewReturnView />
    </Suspense>
  );
}
