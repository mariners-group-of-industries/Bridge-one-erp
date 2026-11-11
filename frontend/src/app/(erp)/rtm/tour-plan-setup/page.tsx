import type { Metadata } from "next";
import { TourPlanSetupView } from "@/features/rtm/views/field";
import { tourPlanSetup } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: tourPlanSetup.label };

export default function TourPlanSetupPage() {
  return <TourPlanSetupView />;
}
