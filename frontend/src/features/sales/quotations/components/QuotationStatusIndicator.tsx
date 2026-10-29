import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { STATUS_LABELS, type QuotationDisplayStatus } from "../schemas/quotation.schema";

const COLORS: Record<QuotationDisplayStatus, IndicatorColor> = {
  DRAFT: "orange",
  SUBMITTED: "green",
  ORDERED: "blue",
  LOST: "red",
  CANCELLED: "gray",
  EXPIRED: "yellow",
};

/** Managerium colours: Approved green, Pending amber, Reject red (plus Ordered blue, Cancelled grey, Expired yellow). */
export function QuotationStatusIndicator({ status }: { status: QuotationDisplayStatus }) {
  return <Indicator color={COLORS[status]}>{STATUS_LABELS[status]}</Indicator>;
}
