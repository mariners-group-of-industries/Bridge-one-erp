import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { delivery } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: delivery.label };

export default function DeliveryPage() {
  return <RtmPagePlaceholder page={delivery} />;
}
