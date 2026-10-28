import type { Metadata } from "next";
import { AttendanceDeviceView } from "@/features/configuration/gateways/attendance-device/components/AttendanceDeviceView";

export const instant = false;

export const metadata: Metadata = { title: "Attendance Devices" };

export default function AttendanceDevicesPage() {
  return <AttendanceDeviceView />;
}
