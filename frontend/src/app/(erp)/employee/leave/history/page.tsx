import type { Metadata } from "next";
import { LeaveHistoryView } from "@/features/ess/components/LeaveViews";

export const instant = false;

export const metadata: Metadata = { title: "My Leave Applications" };

export default function EmployeeLeaveHistoryPage() {
  return <LeaveHistoryView />;
}
