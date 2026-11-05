import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { rtmDashboard } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: rtmDashboard.label };

export default function RtmDashboardPage() {
  return <RtmPagePlaceholder page={rtmDashboard} />;
}
