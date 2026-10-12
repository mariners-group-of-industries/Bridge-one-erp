import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { salesWorkspace } from "@/features/sales/navigation";

export const metadata: Metadata = { title: "Sales" };

export default function SalesWorkspacePage() {
  return <WorkspaceView workspace={salesWorkspace} />;
}
