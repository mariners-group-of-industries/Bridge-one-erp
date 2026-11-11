import type { Metadata } from "next";
import { SrCalendarSetupView } from "@/features/rtm/views/field";
import { srCalendarSetup } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: srCalendarSetup.label };

export default function SrCalendarSetupPage() {
  return <SrCalendarSetupView />;
}
