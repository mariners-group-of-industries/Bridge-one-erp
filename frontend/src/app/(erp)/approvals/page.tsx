import type { Metadata } from "next";
import { MultilayerApprovalView } from "@/features/approvals/components/MultilayerApprovalView";
import { multilayerApproval } from "@/features/approvals/navigation";

// The desk shell renders pages only after the session loads on the client.
export const instant = false;

export const metadata: Metadata = { title: multilayerApproval.label };

export default function MultilayerApprovalPage() {
  return <MultilayerApprovalView />;
}
