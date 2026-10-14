import type { Metadata } from "next";
import { salesReport } from "@/features/sales/navigation";
import { SalesReportView } from "@/features/sales/reports/components/SalesReportView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesReport.label };

export default function SalesReportPage() {
  return <SalesReportView />;
}
