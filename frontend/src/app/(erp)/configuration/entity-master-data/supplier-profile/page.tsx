import type { Metadata } from "next";
import { SupplierListView } from "@/features/configuration/entity-master-data/supplier/components/SupplierListView";

export const instant = false;

export const metadata: Metadata = { title: "Supplier Profile" };

export default function SupplierProfilePage() {
  return <SupplierListView />;
}
