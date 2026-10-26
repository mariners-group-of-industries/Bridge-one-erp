import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { QuotationDetailView } from "@/features/sales/quotations/components/QuotationDetailView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function Quotation({ params }: { params: Promise<{ quotationId: string }> }) {
  const { quotationId } = await params;
  return <QuotationDetailView id={quotationId} />;
}

export default function SalesQuotationPage({ params }: { params: Promise<{ quotationId: string }> }) {
  // Dynamic params are request-time data under Cache Components: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <Quotation params={params} />
    </Suspense>
  );
}
