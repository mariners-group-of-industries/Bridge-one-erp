import type { Metadata } from "next";
import { ItemFormView } from "@/features/configuration/entity-master-data/item/components/ItemFormView";

export const instant = false;

export const metadata: Metadata = { title: "Edit Item" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemFormView itemId={id} />;
}
