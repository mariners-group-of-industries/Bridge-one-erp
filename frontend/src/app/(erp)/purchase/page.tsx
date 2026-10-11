import { WorkspaceView } from "@/components/layout/workspace-view";
import { purchaseWorkspace } from "@/features/purchase/navigation";

export default function PurchaseWorkspacePage() {
  return <WorkspaceView workspace={purchaseWorkspace} />;
}
