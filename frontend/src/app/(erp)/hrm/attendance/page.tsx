import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page";
import { DailyAttendanceView } from "@/features/hrm/attendance/components/DailyAttendanceView";

export const instant = false;

export const metadata: Metadata = {
  title: "Daily Attendance | BridgeOne ERP",
  description:
    "Track daily attendance, in/out punches, late logs, overtime, and manual punch adjustments.",
};

export default function AttendancePage() {
  return (
    <PageContainer full className="pt-2">
      <DailyAttendanceView
        initialRecords={[]}
        initialEmployees={[]}
      />
    </PageContainer>
  );
}
