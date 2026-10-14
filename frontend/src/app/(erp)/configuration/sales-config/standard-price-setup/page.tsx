import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { salesConfigPaths } from "@/features/configuration/sales-config/paths";

export const instant = false;

export const metadata: Metadata = { title: "Standard Price Setup" };

export default function StandardPriceSetupPage() {
  return <PendingProfileView title="Standard Price Setup" path={salesConfigPaths.standardPriceSetup} />;
}
