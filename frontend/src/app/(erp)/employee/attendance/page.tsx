import type { Metadata } from "next";
import { AttendanceView } from "@/features/ess/components/AttendanceView";

export const instant = false;

export const metadata: Metadata = { title: "My Attendance" };

export default function EmployeeAttendancePage() {
  return <AttendanceView />;
}
