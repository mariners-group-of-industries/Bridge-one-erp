import type { Metadata } from "next";
import { ProductionDashboardView } from "@/features/production/dashboard/components/ProductionDashboardView";
import { productionDashboard } from "@/features/production/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: productionDashboard.label };

export default function ProductionDashboardPage() {
  return <ProductionDashboardView />;
}
