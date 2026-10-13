import type { Metadata } from "next";
import { PendingProfileView } from "@/features/configuration/entity-master-data/components/PendingProfileView";
import { entityMasterDataPaths } from "@/features/configuration/entity-master-data/paths";

export const metadata: Metadata = { title: "Item Profile" };

export default function ItemProfilePage() {
  return <PendingProfileView title="Item Profile" path={entityMasterDataPaths.itemProfile} />;
}
