import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/section";
import { salesReportAnalytics } from "@/features/sales/navigation";
import { SalesReportAnalyticsView } from "@/features/sales/reports/components/SalesReportAnalyticsView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesReportAnalytics.label };

/** /sales/reports[?tab=report|analytics] */
export default function SalesReportAnalyticsPage() {
  // The tab is a search param (request-time data): read it inside <Suspense>.
  return (
    <Suspense fallback={<LoadingState />}>
      <SalesReportAnalyticsView />
    </Suspense>
  );
}
