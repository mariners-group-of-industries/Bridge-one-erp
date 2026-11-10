import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { srCalendarSetup } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: srCalendarSetup.label };

export default function SrCalendarSetupPage() {
  return <RtmPagePlaceholder page={srCalendarSetup} />;
}
