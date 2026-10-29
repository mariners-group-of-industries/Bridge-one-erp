import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { EntryWorkspaceView } from "@/features/production/entries/components/EntryWorkspaceView";
import { productionEntry } from "@/features/production/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: productionEntry.label };

/** /production/entries?tab=queue|list */
export default function ProductionEntryPage() {
  // The tab lives in the search params (request-time data): read it inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <EntryWorkspaceView />
    </Suspense>
  );
}
