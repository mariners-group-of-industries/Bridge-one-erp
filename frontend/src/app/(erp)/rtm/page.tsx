import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { rtmWorkspace } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: "RTM - Route to Market" };

export default function RtmWorkspacePage() {
  return <WorkspaceView workspace={rtmWorkspace} />;
}
