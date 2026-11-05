import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { outletTracking } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: outletTracking.label };

export default function OutletTrackingPage() {
  return <RtmPagePlaceholder page={outletTracking} />;
}
