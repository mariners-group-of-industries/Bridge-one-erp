import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { ORDER_STATUS_LABELS, type OrderStatus } from "../schemas/order.schema";

export const ORDER_STATUS_COLORS: Record<OrderStatus, IndicatorColor> = {
  PENDING_APPROVAL: "orange",
  APPROVED: "blue",
  IN_PROGRESS: "purple",
  CLOSED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Indicator color={ORDER_STATUS_COLORS[status]}>{ORDER_STATUS_LABELS[status]}</Indicator>;
}

export const qty2 = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "YYYY-MM-DD" → "DD-MM-YYYY". */
export const day = (value: string) => value.split("-").reverse().join("-");

/** ISO timestamp → "DD-MM-YYYY hh:mm:ss AM" in Bangladesh time. */
export function stamp(iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  return `${day(date.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }))} ${time}`;
}
