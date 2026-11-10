import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { salesTarget } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: salesTarget.label };

export default function SalesTargetPage() {
  return <RtmPagePlaceholder page={salesTarget} />;
}
