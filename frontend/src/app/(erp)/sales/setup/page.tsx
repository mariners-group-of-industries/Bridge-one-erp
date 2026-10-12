import type { Metadata } from "next";
import { SalesSetupView } from "@/features/sales/setup/components/SalesSetupView";

// The desk shell renders pages only after the session loads on the client, so the
// server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export const metadata: Metadata = { title: "Sales Setup" };

export default function SalesSetupPage() {
  return <SalesSetupView />;
}
