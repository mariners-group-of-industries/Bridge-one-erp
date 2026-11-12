import type { Metadata } from "next";
import { RtmDashboardView } from "@/features/rtm/views/dashboards";
import { rtmDashboard } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: rtmDashboard.label };

export default function RtmDashboardPage() {
  return <RtmDashboardView />;
}
