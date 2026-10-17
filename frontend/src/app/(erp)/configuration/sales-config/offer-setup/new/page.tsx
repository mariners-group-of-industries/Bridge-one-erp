import type { Metadata } from "next";
import { OfferFormView } from "@/features/configuration/sales-config/offer/components/OfferFormView";
import { kindFromSlug } from "@/features/configuration/sales-config/offer/schemas/offer.schema";

export const instant = false;

export const metadata: Metadata = { title: "Create Offer" };

export default async function CreateOfferPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <OfferFormView kind={kindFromSlug(type) ?? "ITEM"} />;
}
