import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { STATUS_LABELS, type QuotationDisplayStatus } from "../schemas/quotation.schema";

const COLORS: Record<QuotationDisplayStatus, IndicatorColor> = {
  DRAFT: "red",
  SUBMITTED: "blue",
  ORDERED: "green",
  LOST: "gray",
  CANCELLED: "red",
  EXPIRED: "orange",
};

/** ERPNext colours: Draft red, Open blue, Ordered green, Expired orange. */
export function QuotationStatusIndicator({ status }: { status: QuotationDisplayStatus }) {
  return <Indicator color={COLORS[status]}>{STATUS_LABELS[status]}</Indicator>;
}
