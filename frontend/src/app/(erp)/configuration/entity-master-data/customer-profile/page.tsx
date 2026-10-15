import type { Metadata } from "next";
import { CustomerListView } from "@/features/configuration/entity-master-data/customer/components/CustomerListView";

export const instant = false;

export const metadata: Metadata = { title: "Customer Profile" };

export default function CustomerProfilePage() {
  return <CustomerListView />;
}
