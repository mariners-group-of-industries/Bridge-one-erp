import type { Workspace } from "@/lib/navigation/types";
import { PermittedWorkspace } from "./workspace-view-client";

/** Module landing page: shortcut tiles and grouped links, in the Purchase module style. */
export function WorkspaceView({ workspace }: { workspace: Workspace }) {
  // Only the id crosses to the client (the workspace holds its icon component).
  return <PermittedWorkspace id={workspace.id} fallback={{ label: workspace.label, description: workspace.description }} />;
}
