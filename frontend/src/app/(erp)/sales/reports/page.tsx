import type { Metadata } from "next";
import { SalesPage } from "@/features/sales/components/sales-page";
import { salesReport } from "@/features/sales/navigation";

export const metadata: Metadata = { title: salesReport.label };

export default function SalesReportPage() {
  return <SalesPage link={salesReport} />;
}
