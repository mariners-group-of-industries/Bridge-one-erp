import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { BillDetailView } from "@/features/sales/collections/components/CollectionDetails";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function Bill({ params }: { params: Promise<{ billId: string }> }) {
  return <BillDetailView id={(await params).billId} />;
}

export default function SalesBillPage({ params }: { params: Promise<{ billId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Bill params={params} />
    </Suspense>
  );
}
