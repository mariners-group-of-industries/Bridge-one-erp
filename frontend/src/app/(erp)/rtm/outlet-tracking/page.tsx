import type { Metadata } from "next";
import { OutletTrackingView } from "@/features/rtm/views/field";
import { outletTracking } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: outletTracking.label };

export default function OutletTrackingPage() {
  return <OutletTrackingView />;
}
