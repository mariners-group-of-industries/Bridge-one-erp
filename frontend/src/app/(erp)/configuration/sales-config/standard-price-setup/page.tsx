import type { Metadata } from "next";
import { StandardPriceView } from "@/features/configuration/sales-config/standard-price/components/StandardPriceView";

export const instant = false;

export const metadata: Metadata = { title: "Standard Price Setup" };

export default function StandardPriceSetupPage() {
  return <StandardPriceView />;
}
