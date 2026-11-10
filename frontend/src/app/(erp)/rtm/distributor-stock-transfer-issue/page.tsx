import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { stockTransferIssue } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: stockTransferIssue.label };

export default function StockTransferIssuePage() {
  return <RtmPagePlaceholder page={stockTransferIssue} />;
}
