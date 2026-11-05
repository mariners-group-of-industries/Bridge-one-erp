import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { employeeTracking } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: employeeTracking.label };

export default function EmployeeTrackingPage() {
  return <RtmPagePlaceholder page={employeeTracking} />;
}
