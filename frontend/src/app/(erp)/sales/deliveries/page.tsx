import type { Metadata } from "next";
import { SalesPage } from "@/features/sales/components/sales-page";
import { salesDelivery } from "@/features/sales/navigation";

export const metadata: Metadata = { title: salesDelivery.label };

export default function SalesDeliveryPage() {
  return <SalesPage link={salesDelivery} />;
}
