import type { Metadata } from "next";
import { AttendanceNotificationsView } from "@/features/configuration/gateways/attendance-notifications/components/AttendanceNotificationsView";

export const instant = false;

export const metadata: Metadata = { title: "Attendance Notifications" };

export default function AttendanceNotificationsPage() {
  return <AttendanceNotificationsView />;
}
