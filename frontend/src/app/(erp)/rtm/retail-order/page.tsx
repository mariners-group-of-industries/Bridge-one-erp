import type { Metadata } from "next";
import { RetailOrderView } from "@/features/rtm/views/sales";
import { retailOrder } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: retailOrder.label };

export default function RetailOrderPage() {
  return <RetailOrderView />;
}
