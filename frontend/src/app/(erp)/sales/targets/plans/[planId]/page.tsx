import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { PlanDetailView } from "@/features/sales/targets/components/TargetDetails";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

async function View({ params }: { params: Promise<{ planId: string }> }) {
  return <PlanDetailView id={(await params).planId} />;
}

export default function Page({ params }: { params: Promise<{ planId: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <View params={params} />
    </Suspense>
  );
}
