import type { Metadata } from "next";
import { RtmPagePlaceholder } from "@/features/rtm/components/RtmPagePlaceholder";
import { salesExecutiveDashboard } from "@/features/rtm/navigation";

export const metadata: Metadata = { title: salesExecutiveDashboard.label };

export default function SalesExecutiveDashboardPage() {
  return <RtmPagePlaceholder page={salesExecutiveDashboard} />;
}
