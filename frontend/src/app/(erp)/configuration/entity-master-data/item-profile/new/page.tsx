import type { Metadata } from "next";
import { ItemFormView } from "@/features/configuration/entity-master-data/item/components/ItemFormView";

export const instant = false;

export const metadata: Metadata = { title: "Add Item" };

export default function AddItemPage() {
  return <ItemFormView />;
}
