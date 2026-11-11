import type { Metadata } from "next";
import { SalesExecutiveDashboardView } from "@/features/rtm/views/dashboards";
import { salesExecutiveDashboard } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: salesExecutiveDashboard.label };

export default function SalesExecutiveDashboardPage() {
  return <SalesExecutiveDashboardView />;
}
