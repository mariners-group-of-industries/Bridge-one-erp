import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { stockAdjustment } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: stockAdjustment.label };

export default function StockAdjustmentPage() {
  return <RtmPagePlaceholder page={stockAdjustment} />;
}
