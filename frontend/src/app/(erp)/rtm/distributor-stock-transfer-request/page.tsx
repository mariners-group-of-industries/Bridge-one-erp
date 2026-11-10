import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { stockTransferRequest } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: stockTransferRequest.label };

export default function StockTransferRequestPage() {
  return <RtmPagePlaceholder page={stockTransferRequest} />;
}
