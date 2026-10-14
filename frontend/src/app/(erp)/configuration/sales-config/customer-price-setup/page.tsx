import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { salesConfigPaths } from "@/features/configuration/sales-config/paths";

export const instant = false;

export const metadata: Metadata = { title: "Customer Price Setup" };

export default function CustomerPriceSetupPage() {
  return <PendingProfileView title="Customer Price Setup" path={salesConfigPaths.customerPriceSetup} />;
}
