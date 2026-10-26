import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewBomView } from "@/features/production/bom/components/BomFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Create Bill Of Material" };

/** /production/bill-of-materials/new[?copy=<bomId>] */
export default function NewBillOfMaterialPage() {
  // ?copy lives in the search params (request-time data): read it inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <NewBomView />
    </Suspense>
  );
}
