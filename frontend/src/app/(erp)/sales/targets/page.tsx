import type { Metadata } from "next";
import { SalesPage } from "@/features/sales/components/sales-page";
import { salesTarget } from "@/features/sales/navigation";

export const metadata: Metadata = { title: salesTarget.label };

export default function SalesTargetPage() {
  return <SalesPage link={salesTarget} />;
}
