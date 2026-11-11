import type { Metadata } from "next";
import { SalesAnalyticsView } from "@/features/rtm/views/analytics";
import { salesAnalytics } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: salesAnalytics.label };

export default function SalesAnalyticsPage() {
  return <SalesAnalyticsView />;
}
