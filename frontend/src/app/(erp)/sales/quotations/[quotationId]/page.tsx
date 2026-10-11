import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { QuotationFormView } from "@/features/sales/quotations/components/QuotationFormView";

async function Quotation({ params }: { params: PageProps<"/sales/quotations/[quotationId]">["params"] }) {
  const { quotationId } = await params;
  return <QuotationFormView id={quotationId} />;
}

export default function SalesQuotationFormPage({ params }: PageProps<"/sales/quotations/[quotationId]">) {
  // Dynamic params are request-time data under Cache Components: read them inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <Quotation params={params} />
    </Suspense>
  );
}
