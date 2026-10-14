import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { CollectionPrintView } from "@/features/sales/collections/components/CollectionPrintViews";

export const metadata: Metadata = { title: "Print Money Receipt" };

async function Print({ params }: { params: Promise<{ collectionId: string }> }) {
  return <CollectionPrintView id={(await params).collectionId} />;
}

/** Outside the desk shell. */
export default function PrintPage({ params }: { params: Promise<{ collectionId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Print params={params} />
    </Suspense>
  );
}
