import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EditWorkCenterView } from "@/features/production/work-centers/components/WorkCenterFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Edit Work Center" };

async function EditWorkCenter({ params }: { params: Promise<{ workCenterId: string }> }) {
  return <EditWorkCenterView id={(await params).workCenterId} />;
}

export default function EditWorkCenterPage({ params }: { params: Promise<{ workCenterId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditWorkCenter params={params} />
    </Suspense>
  );
}
