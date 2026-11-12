import type { Metadata } from "next";
import { OfferAndDiscountView } from "@/features/rtm/views/setup";
import { offerAndDiscount } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: offerAndDiscount.label };

export default function OfferAndDiscountPage() {
  return <OfferAndDiscountView />;
}
