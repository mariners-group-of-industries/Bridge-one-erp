"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewQuotationView } from "@/features/sales/quotations/components/QuotationFormView";

function NewQuotation() {
  return <NewQuotationView copyId={useSearchParams().get("copy")} />;
}

/** /sales/quotations/new[?copy=<quotationId>] */
export default function NewSalesQuotationPage() {
  // Search params are request-time data: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <NewQuotation />
    </Suspense>
  );
}
