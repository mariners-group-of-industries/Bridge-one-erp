import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { NewEntryView } from "@/features/production/entries/components/EntryFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Create Production Entry" };

/** /production/entries/new?orderId=<production order> */
export default function NewProductionEntryPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewEntryView />
    </Suspense>
  );
}
