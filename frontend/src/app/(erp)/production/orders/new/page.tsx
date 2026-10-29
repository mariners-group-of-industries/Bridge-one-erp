import type { Metadata } from "next";
import { NewOrderView } from "@/features/production/orders/components/OrderFormView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Create Production Order" };

export default function NewProductionOrderPage() {
  return <NewOrderView />;
}
