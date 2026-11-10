import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { tourPlanSetup } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: tourPlanSetup.label };

export default function TourPlanSetupPage() {
  return <RtmPagePlaceholder page={tourPlanSetup} />;
}
