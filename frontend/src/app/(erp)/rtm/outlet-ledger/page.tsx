import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { outletLedger } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: outletLedger.label };

export default function OutletLedgerPage() {
  return <RtmPagePlaceholder page={outletLedger} />;
}
