import type { Metadata } from "next";
import { CollectionView } from "@/features/rtm/views/sales";
import { collection } from "@/features/rtm/navigation";

export const instant = false;
export const metadata: Metadata = { title: collection.label };

export default function CollectionPage() {
  return <CollectionView />;
}
