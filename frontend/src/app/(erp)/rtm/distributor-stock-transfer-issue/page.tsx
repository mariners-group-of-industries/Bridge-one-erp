import type { Metadata } from "next";
import { StockTransferIssueView } from "@/features/rtm/views/stock";
import { stockTransferIssue } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: stockTransferIssue.label };

export default function StockTransferIssuePage() {
  return <StockTransferIssueView />;
}
