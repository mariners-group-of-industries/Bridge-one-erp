import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { distributorDashboard } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: distributorDashboard.label };

export default function DistributorDashboardPage() {
  return <RtmPagePlaceholder page={distributorDashboard} />;
}
