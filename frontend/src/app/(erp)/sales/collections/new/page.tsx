import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { CollectionFormView } from "@/features/sales/collections/components/CollectionForms";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Collection By Invoice" };

/** /sales/collections/new[?customer=&bill=] */
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CollectionFormView mode="invoice" />
    </Suspense>
  );
}
