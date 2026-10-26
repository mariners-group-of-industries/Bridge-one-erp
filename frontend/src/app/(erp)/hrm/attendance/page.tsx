import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page";
import { DailyAttendanceView } from "@/features/hrm/attendance/components/DailyAttendanceView";
import { getDailyAttendance } from "@/features/hrm/attendance/services/attendance.service";

export const instant = false;

export const metadata: Metadata = {
  title: "Daily Attendance | BridgeOne ERP",
  description:
    "Track daily attendance, in/out punches, late logs, overtime, and manual punch adjustments.",
};

export default async function AttendancePage() {
  const data = await getDailyAttendance({
    fromDate: "2026-09-25",
    toDate: "2026-10-26",
    viewBy: "Employee",
    employeeId: "ALL",
    status: "ALL",
    pageSize: 50,
    page: 1,
  });

  return (
    <PageContainer full className="pt-2">
      <DailyAttendanceView
        initialRecords={data.records}
        initialEmployees={data.employees}
      />
    </PageContainer>
  );
}
