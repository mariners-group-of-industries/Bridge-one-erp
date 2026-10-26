import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditBomView } from "@/features/production/bom/components/BomFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Edit Bill Of Material" };

async function EditBom({ params }: { params: Promise<{ bomId: string }> }) {
  return <EditBomView id={(await params).bomId} />;
}

export default function EditBillOfMaterialPage({ params }: { params: Promise<{ bomId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditBom params={params} />
    </Suspense>
  );
}
