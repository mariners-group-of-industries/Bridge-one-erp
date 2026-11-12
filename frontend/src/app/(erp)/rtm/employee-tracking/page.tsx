import type { Metadata } from "next";
import { EmployeeTrackingView } from "@/features/rtm/views/field";
import { employeeTracking } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: employeeTracking.label };

export default function EmployeeTrackingPage() {
  return <EmployeeTrackingView />;
}
