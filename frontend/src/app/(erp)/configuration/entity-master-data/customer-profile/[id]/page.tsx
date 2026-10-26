import type { Metadata } from "next";
import { CustomerFormView } from "@/features/configuration/entity-master-data/customer/components/CustomerFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerFormView customerId={id} />;
}
