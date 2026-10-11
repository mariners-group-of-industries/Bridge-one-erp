import type { Metadata } from "next";
import { QuotationListView } from "@/features/sales/quotations/components/QuotationListView";

export const metadata: Metadata = { title: "Sales Quotation" };

export default function SalesQuotationPage() {
  return <QuotationListView />;
}
