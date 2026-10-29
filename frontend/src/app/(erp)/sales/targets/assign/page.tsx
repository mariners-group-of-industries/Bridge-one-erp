import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { AssignFormView } from "@/features/sales/targets/components/TargetForms";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Assign Sales Force" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AssignFormView />
    </Suspense>
  );
}
