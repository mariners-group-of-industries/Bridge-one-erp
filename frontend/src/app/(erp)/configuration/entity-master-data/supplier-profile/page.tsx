import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { entityMasterDataPaths } from "@/features/configuration/entity-master-data/paths";

export const metadata: Metadata = { title: "Supplier Profile" };

export default function SupplierProfilePage() {
  return <PendingProfileView title="Supplier Profile" path={entityMasterDataPaths.supplierProfile} />;
}
