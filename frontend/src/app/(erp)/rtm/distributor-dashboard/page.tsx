import type { Metadata } from "next";
import { DistributorDashboardView } from "@/features/rtm/views/dashboards";
import { distributorDashboard } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: distributorDashboard.label };

export default function DistributorDashboardPage() {
  return <DistributorDashboardView />;
}
