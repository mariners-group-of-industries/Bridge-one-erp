import type { Metadata } from "next";
import { RtmConfigurationView } from "@/features/rtm/views/setup";
import { configuration } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: configuration.label };

export default function RtmConfigurationPage() {
  return <RtmConfigurationView />;
}
