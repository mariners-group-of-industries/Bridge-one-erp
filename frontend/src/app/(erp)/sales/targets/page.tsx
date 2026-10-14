import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { salesTarget } from "@/features/sales/navigation";
import { TargetWorkspaceView } from "@/features/sales/targets/components/TargetWorkspaceView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesTarget.label };

/** /sales/targets?tab=target|target-report|sales-target|sales-target-report|commission-setup|commission-report */
export default function SalesTargetPage() {
  // The tab lives in the search params (request-time data): read it inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <TargetWorkspaceView />
    </Suspense>
  );
}
