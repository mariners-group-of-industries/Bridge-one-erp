import type { Metadata } from "next";
import { LeaveBalanceView } from "@/features/ess/components/LeaveViews";

export const instant = false;

export const metadata: Metadata = { title: "Leave Balance" };

export default function EmployeeLeavePage() {
  return <LeaveBalanceView />;
}
