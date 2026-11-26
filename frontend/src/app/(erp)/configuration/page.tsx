import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { configurationWorkspace } from "@/features/configuration/navigation";

export const instant = false;

export const metadata: Metadata = { title: "Configuration" };

export default function ConfigurationWorkspacePage() {
  return <WorkspaceView workspace={configurationWorkspace} />;
}
