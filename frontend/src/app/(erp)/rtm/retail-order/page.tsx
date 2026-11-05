import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { retailOrder } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: retailOrder.label };

export default function RetailOrderPage() {
  return <RtmPagePlaceholder page={retailOrder} />;
}
