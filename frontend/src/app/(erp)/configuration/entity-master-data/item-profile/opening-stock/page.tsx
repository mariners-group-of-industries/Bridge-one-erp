import type { Metadata } from "next";
import { OpeningStockView } from "@/features/configuration/entity-master-data/item/components/OpeningStockView";

export const instant = false;

export const metadata: Metadata = { title: "Opening Stock" };

export default function OpeningStockPage() {
  return <OpeningStockView />;
}
