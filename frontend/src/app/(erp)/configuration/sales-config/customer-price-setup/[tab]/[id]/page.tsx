import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PriceSetupFormView } from "@/features/configuration/sales-config/customer-price/components/PriceSetupFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Prices" };

/** /customer-price-setup/customer/<id> or /customer-price-setup/group/<id>. */
export default async function EditPriceSetupPage({ params }: { params: Promise<{ tab: string; id: string }> }) {
  const { tab, id } = await params;
  if (tab !== "customer" && tab !== "group") notFound();
  return <PriceSetupFormView tab={tab} setupId={id} />;
}
