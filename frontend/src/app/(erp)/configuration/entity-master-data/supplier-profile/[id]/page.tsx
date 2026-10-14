import type { Metadata } from "next";
import { SupplierFormView } from "@/features/configuration/entity-master-data/supplier/components/SupplierFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Supplier" };

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierFormView supplierId={id} />;
}
