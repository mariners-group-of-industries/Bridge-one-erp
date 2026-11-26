/**
 * import-items-json.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Imports an "Item List — All Details" JSON export into Configuration →
 * Entity Master Data → Item Profile. Items whose code already exists in the
 * business unit are skipped (never changed).
 *
 * DRY RUN by default: reads the database and prints what would happen.
 * Pass --apply to write.
 *
 * USAGE (from frontend/):
 *   npx esbuild scripts/import-items-json.ts --bundle --platform=node --format=cjs \
 *     --packages=external --define:import.meta.url=__importMetaUrl \
 *     --banner:js="const __importMetaUrl = require('url').pathToFileURL(__filename).href;" \
 *     --outfile=node_modules/.cache/import-items-json.cjs
 *   node --env-file=.env node_modules/.cache/import-items-json.cjs <file.json> [--unit "<Business Unit>"] [--apply]
 *
 * --unit is needed only when there is more than one business unit.
 *
 * Per row:
 *   Item Code          → code (matched case-insensitively within the business unit)
 *   Printed Item Code  → printedCode (falls back to the item code)
 *   Item Name          → name and printed name
 *   Item Category/Sub  → category tree, matched by name ("[PEA]"-style suffixes ignored);
 *                        names that are not found leave the item uncategorised (listed in the report)
 *   UoM / Alt. UoM / Alt.Unit / Net Weight Unit → uom / altUom + factor / net weight (in KG)
 *   Selling / Retail / Dealer / Trading / Std. Purchase Price, VAT % → prices (0 = not set)
 *   Is Batch → Batch tracking;  Status → active / inactive
 *   Item type comes from the code prefix (RM, PM, FG, SFG, ET, MT, STF …), the "Asset"
 *   category, or the RM/PM/STF description used on the ZZ- items; otherwise Consumables.
 * Placeholder values ("30") are ignored. Current Stock is NOT imported: enter it
 * through Opening Stock so it lands in a warehouse with a cost.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "node:fs";
import { db } from "../src/lib/prisma/client";

interface SourceRow {
  "Item Code": string;
  Barcode?: string | null;
  "Printed Item Code"?: string | null;
  "Item Name": string;
  "Item Description"?: string | null;
  "Item Category"?: string | null;
  "Item Sub Category"?: string | null;
  Brand?: string | null;
  "UoM Name"?: string | null;
  "Net Weight Unit"?: number | null;
  "Alt. UoM"?: string | null;
  "Alt.Unit"?: number | null;
  "Selling Price"?: number | null;
  "Retail Price"?: number | null;
  "Dealer Price"?: number | null;
  "Trading Price"?: number | null;
  "Std. Purchase Price"?: number | null;
  "VAT %"?: number | null;
  "Is Batch"?: boolean;
  Status?: boolean;
}

const PLACEHOLDER = "30";

/** Trims, drops tabs/invisible characters and collapses spaces; blank / placeholder → undefined. */
function clean(value: unknown, max: number): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/[​-‍⁠﻿]/g, "").replace(/\s+/g, " ").trim();
  if (!text || text === PLACEHOLDER) return undefined;
  return text.slice(0, max);
}

/** Positive number as a decimal string, else undefined. */
function positive(value: unknown, decimals: number): string | undefined {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? String(Number(n.toFixed(decimals))) : undefined;
}

/** Codes compare without case. Inner spaces matter: "MT -000074" and "MT-000074" are different items. */
const codeKey = (code: string) => code.trim().toLowerCase();

const CATEGORY_ALIASES: Record<string, string> = { bevarage: "beverage", strach: "starch", lebel: "label", bason: "besan" };
const catKey = (name: string) => {
  const base = name.replace(/\s*\[[^\]]+\]\s*$/, "").trim().toLowerCase();
  return CATEGORY_ALIASES[base] ?? base;
};

const PREFIX_TYPES: [RegExp, string][] = [
  [/^SFG/i, "Semi-Finished Goods"],
  [/^FG/i, "Finished Goods"],
  [/^RM/i, "Raw Material"],
  [/^PM/i, "Packaging Material"],
  [/^(ET|MT)/i, "Spare Parts"],
  [/^AS/i, "Asset"],
  [/^STF/i, "Consumables"],
];
const DESCRIPTION_TYPES: Record<string, string> = { RM: "Raw Material", PM: "Packaging Material", STF: "Consumables" };

function itemTypeFor(code: string, category: string | undefined, description: string | undefined) {
  if (category && catKey(category) === "asset") return "Asset";
  const byPrefix = PREFIX_TYPES.find(([pattern]) => pattern.test(code));
  if (byPrefix) return byPrefix[1];
  return DESCRIPTION_TYPES[(description ?? "").toUpperCase()] ?? "Consumables";
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const unitIndex = args.indexOf("--unit");
  const unitName = unitIndex >= 0 ? args[unitIndex + 1] : undefined;
  const file = args.find((a, i) => !a.startsWith("--") && i !== unitIndex + 1);
  if (!file) throw new Error('Usage: node <bundle> <file.json> [--unit "<Business Unit>"] [--apply]');

  const source = JSON.parse(readFileSync(file, "utf8")) as SourceRow[];
  if (!Array.isArray(source)) throw new Error("Expected a JSON array of items.");

  const units = await db().businessUnit.findMany({ select: { id: true, name: true } });
  const unit = unitName
    ? units.find((u) => u.name.trim().toLowerCase() === unitName.trim().toLowerCase())
    : units.length === 1 ? units[0] : undefined;
  if (!unit) {
    throw new Error(`Pass --unit with one of: ${units.map((u) => `"${u.name}"`).join(", ")}${unitName ? ` ("${unitName}" not found)` : ""}.`);
  }

  const [existing, categories] = await Promise.all([
    db().item.findMany({ where: { businessUnitId: unit.id }, select: { code: true } }),
    db().itemCategory.findMany({ where: { businessUnitId: unit.id }, select: { id: true, name: true, level: true, parentId: true } }),
  ]);
  const taken = new Set(existing.map((item) => codeKey(item.code)));

  /** Category / sub category ids, the same way the Excel upload matches them. */
  function categoryFor(rawCat: string | undefined, rawSub: string | undefined) {
    if (!rawCat) return { id: null as string | null, missing: undefined as string | undefined };
    let category = categories.find((c) => c.level === 1 && catKey(c.name) === catKey(rawCat));
    let sub: (typeof categories)[number] | undefined;
    if (!category) {
      sub = categories.find((c) => c.level === 2 && catKey(c.name) === catKey(rawCat) && c.parentId);
      if (sub) category = categories.find((c) => c.id === sub!.parentId);
    }
    if (!category) return { id: null, missing: rawCat };
    if (rawSub && !sub) {
      sub = categories.find((c) => c.parentId === category!.id && catKey(c.name) === catKey(rawSub));
      if (!sub) return { id: category.id, missing: `${rawSub} (under ${category.name})` };
    }
    return { id: (sub ?? category).id, missing: undefined };
  }

  const skipped: string[] = [];
  const errors: string[] = [];
  const duplicates: string[] = [];
  const missingCategories = new Map<string, number>();
  const types = new Map<string, number>();
  let created = 0;

  for (const row of source) {
    const code = clean(row["Item Code"], 30);
    const name = clean(row["Item Name"], 200) ?? code;
    const label = `${code ?? "(no code)"} (${name ?? ""})`;
    try {
      if (!code || !name) throw new Error("item code and name are required");
      const key = codeKey(code);
      if (taken.has(key)) {
        (existing.some((e) => codeKey(e.code) === key) ? skipped : duplicates).push(label);
        continue;
      }

      const rawCat = clean(row["Item Category"], 100);
      const category = categoryFor(rawCat, clean(row["Item Sub Category"], 100));
      if (category.missing) missingCategories.set(category.missing, (missingCategories.get(category.missing) ?? 0) + 1);

      const itemType = itemTypeFor(code, rawCat, clean(row["Item Description"], 300));
      const altUom = clean(row["Alt. UoM"], 20);
      const altFactor = altUom ? positive(row["Alt.Unit"], 3) : undefined;
      const netWeight = positive(row["Net Weight Unit"], 3);

      taken.add(key);
      if (apply) {
        await db().item.create({
          data: {
            businessUnitId: unit.id,
            code,
            name,
            printedCode: clean(row["Printed Item Code"], 30) ?? code,
            printedName: name,
            itemType,
            uom: clean(row["UoM Name"], 20) ?? "Pcs",
            categoryId: category.id,
            altUom: altFactor ? altUom : null,
            altUomFactor: altFactor ?? null,
            netWeight: netWeight ?? null,
            netWeightUnit: netWeight ? "KG" : null,
            tracking: row["Is Batch"] ? "BATCH" : "NONE",
            barcode: clean(row.Barcode, 60) ?? null,
            brand: clean(row.Brand, 100) ?? null,
            salesRate: positive(row["Selling Price"], 2) ?? "0",
            mrp: positive(row["Retail Price"], 2) ?? null,
            dealerPrice: positive(row["Dealer Price"], 2) ?? null,
            tradingPrice: positive(row["Trading Price"], 2) ?? null,
            purchasePrice: positive(row["Std. Purchase Price"], 2) ?? null,
            vatPercent: positive(row["VAT %"], 2) ?? "0",
            canBeSold: true,
            canBePurchased: true,
            canBeProduced: true,
            isActive: row.Status !== false,
          },
          select: { id: true },
        });
      }
      created += 1;
      types.set(itemType, (types.get(itemType) ?? 0) + 1);
      console.log(`  + ${label} [${itemType}]`);
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(apply ? "\n=== APPLIED ===" : "\n=== DRY RUN (no changes; pass --apply to write) ===");
  console.log(`Business unit:           ${unit.name}`);
  console.log(`Rows in file:            ${source.length}`);
  console.log(`${apply ? "Created" : "Would create"}:            ${created}`, Object.fromEntries(types));
  console.log(`Skipped (already exist): ${skipped.length}`);
  console.log(`Duplicate codes in file: ${duplicates.length}${duplicates.length ? "  " + duplicates.join(", ") : ""}`);
  console.log(`Errors:                  ${errors.length}`);
  if (missingCategories.size > 0) console.log("Categories not found (left uncategorised):", Object.fromEntries(missingCategories));
  if (errors.length > 0) console.log("\nErrors:\n  " + errors.join("\n  "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
