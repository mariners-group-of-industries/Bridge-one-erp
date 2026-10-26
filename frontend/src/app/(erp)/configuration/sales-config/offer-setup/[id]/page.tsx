import type { Metadata } from "next";
import { OfferFormView } from "@/features/configuration/sales-config/offer/components/OfferFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Offer" };

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfferFormView offerId={id} />;
}
