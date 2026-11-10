import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { salesAnalytics } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: salesAnalytics.label };

export default function SalesAnalyticsPage() {
  return <RtmPagePlaceholder page={salesAnalytics} />;
}
