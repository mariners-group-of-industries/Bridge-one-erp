/**
 * Packing unit of an item: how many base units (PCS, JAR …) one pack holds.
 *
 * The item master's Alt. UoM / Alt. Unit wins. When it is empty the pack size
 * is read from the item name, where it is written by convention:
 *   "IRICH Vermicilli 200gm (1x48)"  → 1 CTN = 48 PCS
 *   "Marine Chanachur 12gm (24x36)"  → 1 CTN = 864 PCS
 *   "Marine Milk Cookies 500gx8"     → 1 CTN = 8 JAR
 * Items with no pack size (or a pack of 1) are sold loose in their base unit.
 */
export const PACK_UOM = "CTN";

/** "(150x1x6)" → 1 × 6 = 6 (150 pieces inside each unit, 6 units a box). */
const BRACKETED_3 = /\(\s*\d+\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)\s*\)/i;
/** "(1x48)" → 48, "(24x36)" → 864. */
const BRACKETED = /\(\s*(\d+)\s*[x×]\s*(\d+)\s*\)/gi;
/** "500gx8", "1kg x 12" at the end of the name → 8, 12. */
const TRAILING = /\d\s*(?:g|gm|kg|ml|l|ltr|pcs)?\s*[x×]\s*(\d+)\s*$/i;
/** "48x15gm", "24x35gm" (count × weight) → 48, 24. */
const COUNT_BY_WEIGHT = /\b(\d+)\s*[x×]\s*\d+(?:\.\d+)?\s*(?:g|gm|kg|ml|l|ltr)\b/i;

export function packSizeFromName(name: string): number | null {
  let size = 0;
  const triple = BRACKETED_3.exec(name);
  const bracketed = [...name.matchAll(BRACKETED)].at(-1);
  if (triple) size = Number(triple[1]) * Number(triple[2]);
  else if (bracketed) size = Number(bracketed[1]) * Number(bracketed[2]);
  else size = Number(TRAILING.exec(name)?.[1] ?? COUNT_BY_WEIGHT.exec(name)?.[1] ?? 0);
  return Number.isInteger(size) && size > 1 ? size : null;
}

/** Alt. UoM and factor for an item: the master's own, else the one in its name. */
export function packingOf<F>(item: { name: string; altUom: string | null; altUomFactor: F | null }): {
  altUom: string | null;
  altUomFactor: F | number | null;
} {
  if (item.altUomFactor !== null && item.altUom) return { altUom: item.altUom, altUomFactor: item.altUomFactor };
  const size = packSizeFromName(item.name);
  return size ? { altUom: PACK_UOM, altUomFactor: size } : { altUom: null, altUomFactor: null };
}
