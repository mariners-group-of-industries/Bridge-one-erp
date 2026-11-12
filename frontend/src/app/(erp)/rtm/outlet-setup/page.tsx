import type { Metadata } from "next";
import { OutletSetupView } from "@/features/rtm/views/setup";
import { outletSetup } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: outletSetup.label };

export default function OutletSetupPage() {
  return <OutletSetupView />;
}
