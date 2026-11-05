import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { salesReturn } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: salesReturn.label };

export default function SalesReturnPage() {
  return <RtmPagePlaceholder page={salesReturn} />;
}
