import type { Metadata } from "next";
import { ReturnPriceView } from "@/features/configuration/sales-config/return-price/components/ReturnPriceView";

export const instant = false;

export const metadata: Metadata = { title: "Sales Return Price Setup" };

export default function SalesReturnPage() {
  return <ReturnPriceView />;
}
