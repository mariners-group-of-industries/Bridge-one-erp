import type { Metadata } from "next";
import { QuotationListView } from "@/features/sales/quotations/components/QuotationListView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Sales Quotation" };

export default function SalesQuotationPage() {
  return <QuotationListView />;
}
