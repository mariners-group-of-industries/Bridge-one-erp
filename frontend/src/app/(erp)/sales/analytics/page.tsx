import type { Metadata } from "next";
import { SalesPage } from "@/features/sales/components/sales-page";
import { salesAnalytics } from "@/features/sales/navigation";

export const metadata: Metadata = { title: salesAnalytics.label };

export default function SalesAnalyticsPage() {
  return <SalesPage link={salesAnalytics} />;
}
