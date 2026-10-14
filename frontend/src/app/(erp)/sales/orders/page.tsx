import type { Metadata } from "next";
import { OrderListView } from "@/features/sales/orders/components/OrderListView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Sales Order" };

export default function SalesOrderPage() {
  return <OrderListView />;
}
