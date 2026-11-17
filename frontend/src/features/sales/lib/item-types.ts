import { ITEM_TYPES } from "@/features/configuration/entity-master-data/item/schemas/item.schema";

/** Item Profile's item types (Configuration), plus any other type the given items carry. */
export function itemTypeList(items: readonly { itemType: string | null }[]): string[] {
  const known = new Set<string>(ITEM_TYPES);
  const others = new Set(items.map((item) => item.itemType).filter((type): type is string => !!type && !known.has(type)));
  return [...ITEM_TYPES, ...[...others].sort()];
}
