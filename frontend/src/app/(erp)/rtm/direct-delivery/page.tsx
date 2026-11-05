import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { directDelivery } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: directDelivery.label };

export default function DirectDeliveryPage() {
  return <RtmPagePlaceholder page={directDelivery} />;
}
