import type { Metadata } from "next";
import { PriceSetupFormView } from "@/features/configuration/sales-config/customer-price/components/PriceSetupFormView";
import { tabFromSlug } from "@/features/configuration/sales-config/customer-price/schemas/customer-price.schema";

export const instant = false;

export const metadata: Metadata = { title: "Price Setup" };

export default async function NewPriceSetupPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <PriceSetupFormView tab={tabFromSlug(tab)} />;
}
