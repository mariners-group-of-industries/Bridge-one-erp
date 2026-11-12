import type { Metadata } from "next";
import { SalesReturnView } from "@/features/rtm/views/sales";
import { salesReturn } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: salesReturn.label };

export default function SalesReturnPage() {
  return <SalesReturnView />;
}
