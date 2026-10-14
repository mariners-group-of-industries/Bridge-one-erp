import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { ORDER_STATUS_LABELS, type OrderStatus } from "../schemas/order.schema";

const COLORS: Record<OrderStatus, IndicatorColor> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "orange",
  APPROVED: "green",
  COMPLETED: "blue",
  CANCELLED: "red",
};

export function OrderStatusIndicator({ status }: { status: OrderStatus }) {
  return <Indicator color={COLORS[status]}>{ORDER_STATUS_LABELS[status]}</Indicator>;
}
