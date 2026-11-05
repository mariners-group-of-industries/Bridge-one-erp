import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { configuration } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: configuration.label };

export default function RtmConfigurationPage() {
  return <RtmPagePlaceholder page={configuration} />;
}
