import type { Metadata } from "next";
import { OfferListView } from "@/features/configuration/sales-config/offer/components/OfferListView";
import { kindFromSlug } from "@/features/configuration/sales-config/offer/schemas/offer.schema";

export const instant = false;

export const metadata: Metadata = { title: "Offer Setup" };

export default async function OfferSetupPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <OfferListView initialKind={kindFromSlug(tab) ?? "ITEM"} />;
}
