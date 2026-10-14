import type { Metadata } from "next";
import { NewExchangeView } from "@/features/sales/deliveries/components/DeliveryEntryViews";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Exchange" };

export default function SalesExchangePage() {
  return <NewExchangeView />;
}
