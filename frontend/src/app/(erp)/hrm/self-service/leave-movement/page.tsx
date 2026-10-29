import type { Metadata } from "next";
import { LeaveMovementView } from "@/features/hrm/self-service/leave-movement/components/LeaveMovementView";

export const instant = false;

export const metadata: Metadata = { title: "Leave & Movement" };

export default function LeaveMovementPage() {
  return <LeaveMovementView />;
}
