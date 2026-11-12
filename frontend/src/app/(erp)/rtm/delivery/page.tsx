import type { Metadata } from "next";
import { DeliveryView } from "@/features/rtm/views/sales";
import { delivery } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: delivery.label };

export default function DeliveryPage() {
  return <DeliveryView />;
}
