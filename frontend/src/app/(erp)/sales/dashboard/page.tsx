import type { Metadata } from "next";
import { SalesDashboardView } from "@/features/sales/dashboard/components/SalesDashboardView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Sales Dashboard" };

export default function SalesDashboardPage() {
  return <SalesDashboardView />;
}
