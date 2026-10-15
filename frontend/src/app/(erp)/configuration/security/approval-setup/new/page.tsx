import type { Metadata } from "next";
import { ApprovalFormView } from "@/features/configuration/security/approval/components/ApprovalFormView";

export const instant = false;

export const metadata: Metadata = { title: "Add Approval Setup" };

export default function NewApprovalPage() {
  return <ApprovalFormView />;
}
