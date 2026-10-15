import type { Metadata } from "next";
import { ApprovalListView } from "@/features/configuration/security/approval/components/ApprovalListView";

export const instant = false;

export const metadata: Metadata = { title: "Approval Setup" };

export default function ApprovalSetupPage() {
  return <ApprovalListView />;
}
