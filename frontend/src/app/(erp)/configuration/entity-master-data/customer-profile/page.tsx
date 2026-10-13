import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { entityMasterDataPaths } from "@/features/configuration/entity-master-data/paths";

export const metadata: Metadata = { title: "Customer Profile" };

export default function CustomerProfilePage() {
  return <PendingProfileView title="Customer Profile" path={entityMasterDataPaths.customerProfile} />;
}
