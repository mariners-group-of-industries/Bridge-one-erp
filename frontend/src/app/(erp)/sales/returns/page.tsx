import type { Metadata } from "next";
import { SalesPage } from "@/features/sales/components/sales-page";
import { salesReturn } from "@/features/sales/navigation";

export const metadata: Metadata = { title: salesReturn.label };

export default function SalesReturnPage() {
  return <SalesPage link={salesReturn} />;
}
