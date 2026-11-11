import type { Metadata } from "next";
import { DistributionChannelView } from "@/features/rtm/views/setup";
import { distributionChannel } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: distributionChannel.label };

export default function DistributionChannelPage() {
  return <DistributionChannelView />;
}
