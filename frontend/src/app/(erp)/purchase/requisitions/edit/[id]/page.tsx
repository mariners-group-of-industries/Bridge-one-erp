import React, { Suspense } from "react";
import { CreateRequisitionView } from "@/features/purchase/components/CreateRequisitionView";

export const instant = false;

export default async function EditRequisitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-faint">Loading Requisition…</div>}>
      <CreateRequisitionView editId={id} />
    </Suspense>
  );
}
