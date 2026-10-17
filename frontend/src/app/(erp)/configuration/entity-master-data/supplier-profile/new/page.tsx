import type { Metadata } from "next";
import { SupplierFormView } from "@/features/configuration/entity-master-data/supplier/components/SupplierFormView";

export const instant = false;

export const metadata: Metadata = { title: "Add Supplier" };

export default function AddSupplierPage() {
  return <SupplierFormView />;
}
