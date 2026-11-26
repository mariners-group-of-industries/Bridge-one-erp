import type { Metadata } from "next";
import { LeaveApplyView } from "@/features/ess/components/LeaveViews";

export const instant = false;

export const metadata: Metadata = { title: "Apply for Leave" };

export default function EmployeeLeaveApplyPage() {
  return <LeaveApplyView />;
}
