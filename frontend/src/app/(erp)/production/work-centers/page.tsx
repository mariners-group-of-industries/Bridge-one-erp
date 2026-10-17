import type { Metadata } from "next";
import { workCenter } from "@/features/production/navigation";
import { WorkCenterListView } from "@/features/production/work-centers/components/WorkCenterListView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: workCenter.label };

export default function WorkCenterPage() {
  return <WorkCenterListView />;
}
