import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { ReturnDetailView } from "@/features/sales/returns/components/ReturnDetailView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function SalesReturn({ params }: { params: Promise<{ returnId: string }> }) {
  return <ReturnDetailView id={(await params).returnId} />;
}

export default function SalesReturnDetailPage({ params }: { params: Promise<{ returnId: string }> }) {
  // Dynamic params are request-time data under Cache Components: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <SalesReturn params={params} />
    </Suspense>
  );
}
