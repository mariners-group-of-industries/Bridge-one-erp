import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { offerAndDiscount } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: offerAndDiscount.label };

export default function OfferAndDiscountPage() {
  return <RtmPagePlaceholder page={offerAndDiscount} />;
}
