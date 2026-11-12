import type { Metadata } from "next";
import { DirectDeliveryView } from "@/features/rtm/views/sales";
import { directDelivery } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: directDelivery.label };

export default function DirectDeliveryPage() {
  return <DirectDeliveryView />;
}
