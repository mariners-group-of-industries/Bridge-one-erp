import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { salesWorkspace } from "@/features/sales/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Sales" };

export default function SalesWorkspacePage() {
  return <WorkspaceView workspace={salesWorkspace} />;
}
