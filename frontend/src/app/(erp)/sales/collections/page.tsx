import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { CollectionWorkspaceView } from "@/features/sales/collections/components/CollectionWorkspaceView";
import { salesCollection } from "@/features/sales/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesCollection.label };

/** /sales/collections?tab=due|bills|collected|due-report|ledger|advance */
export default function SalesCollectionPage() {
  // The tab lives in the search params (request-time data): read it inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <CollectionWorkspaceView />
    </Suspense>
  );
}
