import type { Metadata } from "next";
import { ProductionPage } from "@/features/production/components/production-page";
import { productionEntry } from "@/features/production/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: productionEntry.label };

export default function Page() {
  return <ProductionPage link={productionEntry} />;
}
