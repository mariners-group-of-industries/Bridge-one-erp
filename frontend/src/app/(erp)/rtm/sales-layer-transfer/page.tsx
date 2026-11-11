import type { Metadata } from "next";
import { SalesLayerTransferView } from "@/features/rtm/views/field";
import { salesLayerTransfer } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: salesLayerTransfer.label };

export default function SalesLayerTransferPage() {
  return <SalesLayerTransferView />;
}
