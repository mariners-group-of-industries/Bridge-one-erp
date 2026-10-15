import type { Metadata } from "next";
import { CustomerPriceListView } from "@/features/configuration/sales-config/customer-price/components/CustomerPriceListView";
import { tabFromSlug } from "@/features/configuration/sales-config/customer-price/schemas/customer-price.schema";

export const instant = false;

export const metadata: Metadata = { title: "Customer Price Setup" };

export default async function CustomerPriceSetupPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <CustomerPriceListView initialTab={tabFromSlug(tab)} />;
}
