import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { salesConfigPaths } from "@/features/configuration/sales-config/paths";

export const instant = false;

export const metadata: Metadata = { title: "Sales Return" };

export default function SalesReturnPage() {
  return <PendingProfileView title="Sales Return" path={salesConfigPaths.salesReturn} />;
}
