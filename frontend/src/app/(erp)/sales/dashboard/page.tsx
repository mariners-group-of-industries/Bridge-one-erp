import type { Metadata } from "next";
import { SalesDashboardView } from "@/features/sales/dashboard/components/SalesDashboardView";

export const metadata: Metadata = { title: "Sales Dashboard" };

export default function SalesDashboardPage() {
  return <SalesDashboardView />;
}
