import type { Metadata } from "next";
import { SalesPage } from "@/features/sales/components/sales-page";
import { salesCollection } from "@/features/sales/navigation";

export const metadata: Metadata = { title: salesCollection.label };

export default function SalesCollectionPage() {
  return <SalesPage link={salesCollection} />;
}
