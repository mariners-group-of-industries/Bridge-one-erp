import type { Metadata } from "next";
import { productionOrder } from "@/features/production/navigation";
import { OrderListView } from "@/features/production/orders/components/OrderListView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: productionOrder.label };

export default function ProductionOrderPage() {
  return <OrderListView />;
}
