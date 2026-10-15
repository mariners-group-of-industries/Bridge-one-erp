import type { Metadata } from "next";
import { ItemListView } from "@/features/configuration/entity-master-data/item/components/ItemListView";

export const instant = false;

export const metadata: Metadata = { title: "Item Profile" };

export default function ItemProfilePage() {
  return <ItemListView />;
}
