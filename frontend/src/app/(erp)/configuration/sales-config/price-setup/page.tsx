import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { salesConfigPaths } from "@/features/configuration/sales-config/paths";

export const instant = false;

export const metadata: Metadata = { title: "Price Setup" };

export default function PriceSetupPage() {
  return <PendingProfileView title="Price Setup" path={salesConfigPaths.priceSetup} />;
}
