import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { hrmWorkspace } from "@/features/hrm/navigation";

export const metadata: Metadata = { title: "HRM - Human Resource Management" };

export default function HrmWorkspacePage() {
  return <WorkspaceView workspace={hrmWorkspace} />;
}
