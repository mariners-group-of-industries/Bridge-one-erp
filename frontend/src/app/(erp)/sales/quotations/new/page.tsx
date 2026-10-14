import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewQuotationView } from "@/features/sales/quotations/components/QuotationFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "New Sales Quotation" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function NewQuotation({ searchParams }: { searchParams: SearchParams }) {
  const { copy } = await searchParams;
  return <NewQuotationView copyId={typeof copy === "string" ? copy : null} />;
}

/** /sales/quotations/new[?copy=<quotationId>] */
export default function NewSalesQuotationPage({ searchParams }: { searchParams: SearchParams }) {
  // Search params are request-time data: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <NewQuotation searchParams={searchParams} />
    </Suspense>
  );
}
