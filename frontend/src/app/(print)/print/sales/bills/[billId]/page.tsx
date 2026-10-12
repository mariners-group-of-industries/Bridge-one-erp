import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { BillPrintView } from "@/features/sales/collections/components/CollectionPrintViews";

export const metadata: Metadata = { title: "Print Bill" };

async function Print({ params }: { params: Promise<{ billId: string }> }) {
  return <BillPrintView id={(await params).billId} />;
}

/** Outside the desk shell. */
export default function PrintPage({ params }: { params: Promise<{ billId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Print params={params} />
    </Suspense>
  );
}
