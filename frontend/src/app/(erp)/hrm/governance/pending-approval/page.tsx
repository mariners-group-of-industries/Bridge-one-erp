import type { Metadata } from "next";
import { PendingApprovalView } from "@/features/hrm/governance/components/GovernanceViews";

export const instant = false;

export const metadata: Metadata = { title: "Pending Approval" };

export default function PendingApprovalPage() {
  return <PendingApprovalView />;
}
