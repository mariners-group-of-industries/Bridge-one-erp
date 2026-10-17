import type { Metadata } from "next";
import { ProductionPage } from "@/features/production/components/production-page";
import { billOfMaterial } from "@/features/production/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: billOfMaterial.label };

export default function Page() {
  return <ProductionPage link={billOfMaterial} />;
}
