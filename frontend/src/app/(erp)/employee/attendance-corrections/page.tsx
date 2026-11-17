import type { Metadata } from "next";
import { CorrectionsView } from "@/features/ess/components/CorrectionsView";

export const instant = false;

export const metadata: Metadata = { title: "Attendance Corrections" };

export default function EmployeeAttendanceCorrectionsPage() {
  return <CorrectionsView />;
}
