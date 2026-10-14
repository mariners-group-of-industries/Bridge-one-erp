import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditReturnView } from "@/features/sales/returns/components/ReturnFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function EditReturn({ params }: { params: Promise<{ returnId: string }> }) {
  return <EditReturnView id={(await params).returnId} />;
}

export default function EditSalesReturnPage({ params }: { params: Promise<{ returnId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditReturn params={params} />
    </Suspense>
  );
}
