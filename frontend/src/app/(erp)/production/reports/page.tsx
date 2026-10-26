import type { Metadata } from "next";
import { productionReport } from "@/features/production/navigation";
import { ProductionReportView } from "@/features/production/reports/components/ProductionReportView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: productionReport.label };

export default function ProductionReportPage() {
  return <ProductionReportView />;
}
