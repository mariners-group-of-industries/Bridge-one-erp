import type { Metadata } from "next";
import { DailyAttendanceView } from "@/features/ess/components/DailyAttendanceView";

export const instant = false;

export const metadata: Metadata = { title: "Daily Attendance" };

export default function EmployeeDailyAttendancePage() {
  return <DailyAttendanceView />;
}
