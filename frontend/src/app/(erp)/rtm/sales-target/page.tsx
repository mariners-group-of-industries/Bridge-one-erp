import type { Metadata } from "next";
import { SalesTargetView } from "@/features/rtm/views/setup";
import { salesTarget } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: salesTarget.label };

export default function SalesTargetPage() {
  return <SalesTargetView />;
}
