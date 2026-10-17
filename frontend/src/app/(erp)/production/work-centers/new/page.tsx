import type { Metadata } from "next";
import { NewWorkCenterView } from "@/features/production/work-centers/components/WorkCenterFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "New Work Center" };

export default function NewWorkCenterPage() {
  return <NewWorkCenterView />;
}
