import type { Metadata } from "next";
import { StockTransferRequestView } from "@/features/rtm/views/stock";
import { stockTransferRequest } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: stockTransferRequest.label };

export default function StockTransferRequestPage() {
  return <StockTransferRequestView />;
}
