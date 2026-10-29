import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditQuotationView } from "@/features/sales/quotations/components/QuotationFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Edit Sales Quotation" };

async function EditQuotation({ params }: { params: Promise<{ quotationId: string }> }) {
  return <EditQuotationView id={(await params).quotationId} />;
}

export default function EditSalesQuotationPage({ params }: { params: Promise<{ quotationId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditQuotation params={params} />
    </Suspense>
  );
}
