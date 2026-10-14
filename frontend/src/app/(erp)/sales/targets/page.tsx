import type { Metadata } from "next";
import { SalesPage } from "@/features/sales/components/sales-page";
import { salesTarget } from "@/features/sales/navigation";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: salesTarget.label };

export default function SalesTargetPage() {
  return <SalesPage link={salesTarget} />;
}
