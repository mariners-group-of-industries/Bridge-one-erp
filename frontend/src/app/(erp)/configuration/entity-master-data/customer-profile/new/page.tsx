import type { Metadata } from "next";
import { CustomerFormView } from "@/features/configuration/entity-master-data/customer/components/CustomerFormView";

export const instant = false;

export const metadata: Metadata = { title: "Add Customer" };

export default function AddCustomerPage() {
  return <CustomerFormView />;
}
