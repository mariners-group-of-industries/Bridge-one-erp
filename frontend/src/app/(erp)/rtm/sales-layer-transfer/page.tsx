import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { salesLayerTransfer } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: salesLayerTransfer.label };

export default function SalesLayerTransferPage() {
  return <RtmPagePlaceholder page={salesLayerTransfer} />;
}
