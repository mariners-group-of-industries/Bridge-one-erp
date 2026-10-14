import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { CollectionDetailView } from "@/features/sales/collections/components/CollectionDetails";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function Collection({ params }: { params: Promise<{ collectionId: string }> }) {
  return <CollectionDetailView id={(await params).collectionId} />;
}

export default function SalesCollectionDetailPage({ params }: { params: Promise<{ collectionId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Collection params={params} />
    </Suspense>
  );
}
