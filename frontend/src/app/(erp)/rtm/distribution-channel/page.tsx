import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { distributionChannel } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: distributionChannel.label };

export default function DistributionChannelPage() {
  return <RtmPagePlaceholder page={distributionChannel} />;
}
