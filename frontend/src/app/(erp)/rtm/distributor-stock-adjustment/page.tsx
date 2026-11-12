import type { Metadata } from "next";
import { StockAdjustmentView } from "@/features/rtm/views/stock";
import { stockAdjustment } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: stockAdjustment.label };

export default function StockAdjustmentPage() {
  return <StockAdjustmentView />;
}
