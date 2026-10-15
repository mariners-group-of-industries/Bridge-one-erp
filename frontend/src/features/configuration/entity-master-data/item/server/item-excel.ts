import ExcelJS from "exceljs";
import { cellText, describe, parseFlag } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import {
  ITEM_FLAGS,
  ITEM_TYPES,
  MAX_ITEM_IMPORT_ROWS,
  RESTRICTED_AGES,
  type ItemFlag,
  type ItemImportResult,
  type ItemInput,
} from "../schemas/item.schema";
import { createItem, getFormOptions } from "./item.service";

/**
 * Item bulk upload. One row per item; division and categories are matched by
 * name (category → sub category → minor category, following the tree).
 */

const COLUMNS = [
  { key: "businessUnit", header: "Business Unit", width: 20 },
  { key: "code", header: "Master Item Code *", width: 18 },
  { key: "printedCode", header: "Printed Item Code *", width: 18 },
  { key: "name", header: "Master Item Name *", width: 30 },
  { key: "printedName", header: "Printed / Customer Name *", width: 30 },
  { key: "itemType", header: "Item Type", width: 18 },
  { key: "uom", header: "UOM *", width: 10 },
  { key: "division", header: "Division", width: 16 },
  { key: "category", header: "Category", width: 16 },
  { key: "subCategory", header: "Sub Category", width: 16 },
  { key: "minorCategory", header: "Minor Category", width: 16 },
  { key: "altUom", header: "Alt. UOM", width: 10 },
  { key: "altUnit", header: "Alt. Unit", width: 10 },
  { key: "netWeight", header: "Net Weight", width: 11 },
  { key: "netWeightUnit", header: "Net Weight Unit", width: 14 },
  { key: "restrictedAge", header: "Restricted Ages", width: 14 },
  { key: "tracking", header: "Tracking (None/Both)", width: 18 },
  { key: "barcode", header: "Barcode", width: 16 },
  { key: "brand", header: "Brand", width: 16 },
  { key: "sellingPrice", header: "Selling Price", width: 13 },
  { key: "retailPrice", header: "Retail Price", width: 13 },
  { key: "dealerPrice", header: "Dealer Price", width: 13 },
  { key: "tradingPrice", header: "Trading Price", width: 13 },
  { key: "purchasePrice", header: "Purchase Price", width: 14 },
  { key: "vatPercent", header: "VAT %", width: 8 },
  ...ITEM_FLAGS.map((flag) => ({ key: flag.key, header: flag.label, width: Math.max(10, flag.label.length + 2) })),
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
const normal = (value: string) => value.trim().toLowerCase().replace(/\s*\*$/, "");
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function itemImportTemplate(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Items", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF1E3A8A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };

  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 110 }];
  [
    "One row per item on the Items sheet. Columns marked * are required.",
    "Business Unit: needed only when you have more than one business unit.",
    "Division, Category, Sub Category and Minor Category must match existing names (case does not matter).",
    `Item Type: ${ITEM_TYPES.join(", ")}.`,
    `Restricted Ages: ${RESTRICTED_AGES.join(", ")}. Tracking: None or Both.`,
    "Can be Sold and Can be Purchased are Yes when left empty; other Yes/No columns are No when empty.",
    "Leave Barcode empty and set Auto Barcode = Yes to have one generated.",
  ].forEach((line) => help.addRow([line]));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function importItems(actor: Actor, bytes: Uint8Array): Promise<ItemImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.getWorksheet("Items") ?? workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");

  const headerIndex = new Map<ColumnKey, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const match = COLUMNS.find((c) => normal(c.header) === normal(cellText(cell.value)));
    if (match) headerIndex.set(match.key, column);
  });
  for (const required of ["code", "printedCode", "name", "printedName", "uom"] as const) {
    if (!headerIndex.has(required)) {
      throw new AppError(400, "VALIDATION_ERROR", `Column "${COLUMNS.find((c) => c.key === required)!.header}" is missing. Use the template.`);
    }
  }

  const rows: { row: number; get: (k: ColumnKey) => string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (k: ColumnKey) => {
      const column = headerIndex.get(k);
      return column ? cellText(row.getCell(column).value) : "";
    };
    if (COLUMNS.every((c) => get(c.key) === "")) return;
    rows.push({ row: rowNumber, get });
  });
  if (rows.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The sheet has no item rows.");
  if (rows.length > MAX_ITEM_IMPORT_ROWS) throw new AppError(400, "VALIDATION_ERROR", `Upload at most ${MAX_ITEM_IMPORT_ROWS} items per file.`);

  const options = await getFormOptions(actor);
  const result: ItemImportResult = { created: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      let unitId: string;
      if (get("businessUnit")) {
        const unit = options.businessUnits.find((u) => same(u.name, get("businessUnit")));
        if (!unit) throw new Error(`Business unit "${get("businessUnit")}" not found.`);
        unitId = unit.id;
      } else if (options.businessUnits.length === 1) {
        unitId = options.businessUnits[0].id;
      } else {
        throw new Error("Business Unit is required (you have more than one).");
      }

      const find = <T extends { name: string }>(list: T[], label: string, value: string, extra: (item: T) => boolean) => {
        if (!value) return undefined;
        const found = list.find((item) => same(item.name, value) && extra(item));
        if (!found) throw new Error(`${label} "${value}" not found.`);
        return found;
      };
      const division = find(options.divisions, "Division", get("division"), (d) => d.businessUnitId === unitId);
      const category = find(options.categories, "Category", get("category"), (c) => c.level === 1 && c.businessUnitId === unitId);
      if (get("subCategory") && !category) throw new Error("Sub Category needs a Category.");
      const sub = find(options.categories, "Sub Category", get("subCategory"), (c) => c.parentId === category?.id);
      if (get("minorCategory") && !sub) throw new Error("Minor Category needs a Sub Category.");
      const minor = find(options.categories, "Minor Category", get("minorCategory"), (c) => c.parentId === sub?.id);

      const pick = <T extends string>(list: readonly T[], label: string, value: string): T | "" => {
        if (!value) return "";
        const found = list.find((item) => same(item, value));
        if (!found) throw new Error(`${label}: use ${list.join(", ")}.`);
        return found;
      };
      const tracking = get("tracking") ? pick(["None", "Both"] as const, "Tracking", get("tracking")) : "None";
      // Sold/purchased default to Yes like the form.
      const flags = Object.fromEntries(
        ITEM_FLAGS.map((flag) => {
          const raw = get(flag.key);
          const defaultYes = flag.key === "canBeSold" || flag.key === "canBePurchased";
          return [flag.key, raw === "" ? defaultYes : parseFlag(raw, flag.label)];
        }),
      ) as Record<ItemFlag, boolean>;

      const input: ItemInput = {
        businessUnitId: unitId,
        ...flags,
        code: get("code"),
        printedCode: get("printedCode"),
        name: get("name"),
        printedName: get("printedName"),
        itemType: pick(ITEM_TYPES, "Item Type", get("itemType")),
        uom: get("uom"),
        divisionId: division?.id ?? "",
        categoryId: category?.id ?? "",
        subCategoryId: sub?.id ?? "",
        minorCategoryId: minor?.id ?? "",
        altUom: get("altUom"),
        altUnit: get("altUnit"),
        netWeight: get("netWeight"),
        netWeightUnit: get("netWeightUnit"),
        restrictedAge: pick(RESTRICTED_AGES, "Restricted Ages", get("restrictedAge")),
        tracking: tracking === "Both" ? "BOTH" : "NONE",
        barcode: get("barcode"),
        brand: get("brand"),
        sellingPrice: get("sellingPrice"),
        retailPrice: get("retailPrice"),
        dealerPrice: get("dealerPrice"),
        tradingPrice: get("tradingPrice"),
        purchasePrice: get("purchasePrice"),
        vatPercent: get("vatPercent"),
      };
      await createItem(actor, input);
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
