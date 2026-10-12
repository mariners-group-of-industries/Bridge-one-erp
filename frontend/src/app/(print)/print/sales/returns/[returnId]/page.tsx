import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { ReturnPrintView } from "@/features/sales/returns/components/ReturnPrintView";

export const metadata: Metadata = { title: "Print Sales Return" };

async function PrintReturn({ params }: { params: Promise<{ returnId: string }> }) {
  return <ReturnPrintView id={(await params).returnId} />;
}

/** /print/sales/returns/:id — outside the desk shell. */
export default function PrintSalesReturnPage({ params }: { params: Promise<{ returnId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <PrintReturn params={params} />
    </Suspense>
  );
}
