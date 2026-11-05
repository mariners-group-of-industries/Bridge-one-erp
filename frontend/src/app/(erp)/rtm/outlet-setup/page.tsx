import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { outletSetup } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: outletSetup.label };

export default function OutletSetupPage() {
  return <RtmPagePlaceholder page={outletSetup} />;
}
