import type { Metadata } from "next";
import { OrderListView } from "@/features/sales/orders/components/OrderListView";

export const metadata: Metadata = { title: "Sales Order" };

export default function SalesOrderPage() {
  return <OrderListView />;
}
