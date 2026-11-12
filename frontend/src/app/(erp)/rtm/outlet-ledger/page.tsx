import type { Metadata } from "next";
import { OutletLedgerView } from "@/features/rtm/views/sales";
import { outletLedger } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: outletLedger.label };

export default function OutletLedgerPage() {
  return <OutletLedgerView />;
}
