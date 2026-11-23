import type { Metadata } from "next";
import { Suspense } from "react";
import { PendingApprovalView } from "@/features/hrm/governance/components/GovernanceViews";

export const instant = false;

export const metadata: Metadata = { title: "Pending Approval" };

export default function PendingApprovalPage() {
  // The view reads ?kind= from the URL.
  return (
    <Suspense>
      <PendingApprovalView />
    </Suspense>
  );
}
