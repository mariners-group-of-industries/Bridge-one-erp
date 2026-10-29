import type { Metadata } from "next";
import { salesAnalytics } from "@/features/sales/navigation";
import { SalesAnalyticsView } from "@/features/sales/reports/components/SalesAnalyticsView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesAnalytics.label };

export default function SalesAnalyticsPage() {
  return <SalesAnalyticsView />;
}
