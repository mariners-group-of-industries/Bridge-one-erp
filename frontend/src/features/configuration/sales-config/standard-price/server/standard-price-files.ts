import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { cellText, describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { AppError, badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { etpOf, type StandardPriceFilter, type StandardPriceImportResult, type StandardPriceRow, type StandardPriceRowInput } from "../schemas/standard-price.schema";
import { allStandardPrices, loadUnit, saveStandardPrices } from "./standard-price.service";

/**
 * Excel download / bulk upload and PDF print for Standard Price Setup. The
 * download doubles as the upload template: edit the prices and upload it back.
 */

const COLUMNS = [
  { key: "code", header: "Item Code *", width: 16 },
  { key: "name", header: "Item Name", width: 30 },
  { key: "uom", header: "UoM", width: 8 },
  { key: "effectiveFrom", header: "Effective From (YYYY-MM-DD) *", width: 26 },
  { key: "costPrice", header: "Cost Price", width: 12 },
  { key: "increaseValue", header: "Price Increase", width: 13 },
  { key: "increaseType", header: "(%)/Amount", width: 11 },
  { key: "etpPrice", header: "ETP Price", width: 12 },
  { key: "dealerPrice", header: "Dealer Price", width: 12 },
  { key: "tradingPrice", header: "Trading Price", width: 13 },
  { key: "mrp", header: "Retail Price (MRP)", width: 16 },
  { key: "minSalesPrice", header: "Minimum Sales Price", width: 18 },
  { key: "remarks", header: "Remarks", width: 28 },
] as const;

const typeLabel = (row: StandardPriceRow) => (row.increaseType === "AMOUNT" ? "Amount" : "%");

export async function exportStandardPrices(actor: Actor, filter: StandardPriceFilter): Promise<Uint8Array> {
  const { rows } = await allStandardPrices(actor, filter);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Standard Price", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF1E3A8A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  for (const row of rows) sheet.addRow({ ...row, increaseType: typeLabel(row) });

  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 110 }];
  [
    "Edit the prices and upload this file back with Bulk Upload. Columns marked * are required; Item Name and UoM are for reading only.",
    "Each row is saved as the item's price from its Effective From date. The same item and date updates that price; a new date adds one.",
    "(%)/Amount: % or Amount. An empty ETP Price is worked out as Cost Price + Price Increase.",
    "Dates in force today also update the Item Profile prices (cost, dealer, trading, MRP).",
  ].forEach((line) => help.addRow([line]));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

// ─── Upload ───────────────────────────────────────────────────────────────────

const normal = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s*\*$/, "");
const amount = (value: string) => value.replace(/,/g, "").trim();

export async function importStandardPrices(actor: Actor, businessUnitId: string, bytes: Uint8Array): Promise<StandardPriceImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");
  const index = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const match = COLUMNS.find((c) => normal(c.header) === normal(cellText(cell.value)));
    if (match) index.set(match.key, column);
  });
  for (const required of COLUMNS.filter((c) => c.header.endsWith("*"))) {
    if (!index.has(required.key)) throw new AppError(400, "VALIDATION_ERROR", `Column "${required.header}" is missing. Use the downloaded Excel as the template.`);
  }

  await loadUnit(actor, businessUnitId);
  const items = await db().item.findMany({ where: { businessUnitId }, select: { id: true, code: true } });
  const byCode = new Map(items.map((item) => [item.code.trim().toLowerCase(), item.id]));
  const result: StandardPriceImportResult = { created: 0, updated: 0, errors: [] };
  const seen = new Set<string>();
  let rowCount = 0;

  const rows: { row: number; input: StandardPriceRowInput }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (key: string) => {
      const column = index.get(key);
      if (!column) return "";
      const value = row.getCell(column).value;
      return value instanceof Date ? value.toISOString().slice(0, 10) : cellText(value);
    };
    if (COLUMNS.every((c) => get(c.key) === "")) return;
    rowCount += 1;
    try {
      const itemId = byCode.get(get("code").toLowerCase());
      if (!itemId) throw new Error(`Item code "${get("code")}" not found.`);
      const effectiveFrom = get("effectiveFrom");
      const key = `${itemId}|${effectiveFrom}`;
      if (seen.has(key)) throw new Error("This item and Effective From already appear above.");
      seen.add(key);
      const typeText = get("increaseType").toLowerCase();
      const increaseType = typeText === "" || typeText === "%" || typeText.startsWith("percent") ? "PERCENT" : typeText.startsWith("amount") ? "AMOUNT" : null;
      if (!increaseType) throw new Error(`(%)/Amount must be "%" or "Amount", not "${get("increaseType")}".`);
      const costPrice = amount(get("costPrice"));
      const increaseValue = amount(get("increaseValue"));
      rows.push({
        row: rowNumber,
        input: {
          itemId,
          effectiveFrom,
          costPrice,
          increaseType,
          increaseValue,
          etpPrice: amount(get("etpPrice")) || etpOf(costPrice, increaseType, increaseValue),
          dealerPrice: amount(get("dealerPrice")),
          tradingPrice: amount(get("tradingPrice")),
          mrp: amount(get("mrp")),
          minSalesPrice: amount(get("minSalesPrice")),
          remarks: get("remarks"),
        },
      });
    } catch (error) {
      result.errors.push({ row: rowNumber, message: describe(error) });
    }
  });
  if (rowCount === 0) throw new AppError(400, "VALIDATION_ERROR", "The sheet has no price rows.");
  if (rowCount > 5000) throw badRequest("Upload at most 5000 rows per file.");

  // Rows are saved one by one so a bad row does not stop the others.
  for (const { row, input } of rows) {
    try {
      const saved = await saveStandardPrices(actor, { businessUnitId, rows: [input] });
      result.created += saved.created;
      result.updated += saved.updated;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  result.errors.sort((a, b) => a.row - b.row);
  return result;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

const PDF_COLUMNS: { key: keyof StandardPriceRow | "sl" | "increase"; header: string; width: number; align?: "right" }[] = [
  { key: "sl", header: "SL", width: 24, align: "right" },
  { key: "code", header: "Item Code", width: 62 },
  { key: "name", header: "Item Name", width: 140 },
  { key: "uom", header: "UoM", width: 34 },
  { key: "effectiveFrom", header: "Effective", width: 56 },
  { key: "costPrice", header: "Cost", width: 52, align: "right" },
  { key: "increase", header: "Increase", width: 52, align: "right" },
  { key: "etpPrice", header: "ETP", width: 52, align: "right" },
  { key: "dealerPrice", header: "Dealer", width: 52, align: "right" },
  { key: "tradingPrice", header: "Trading", width: 52, align: "right" },
  { key: "mrp", header: "MRP", width: 52, align: "right" },
  { key: "minSalesPrice", header: "Min. Sales", width: 56, align: "right" },
  { key: "remarks", header: "Remarks", width: 74 },
];

function fit(text: string, font: PDFFont, size: number, width: number) {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

const cellOf = (row: StandardPriceRow, key: (typeof PDF_COLUMNS)[number]["key"], index: number) => {
  if (key === "sl") return String(index + 1);
  if (key === "increase") return row.increaseValue === "" ? "" : row.increaseType === "AMOUNT" ? row.increaseValue : `${row.increaseValue}%`;
  if (key === "effectiveFrom") return row.effectiveFrom.split("-").reverse().join("-");
  return String(row[key] ?? "");
};

/** A4 landscape table of the filtered list. */
export async function standardPricePdf(actor: Actor, filter: StandardPriceFilter): Promise<Uint8Array> {
  const { rows } = await allStandardPrices(actor, filter);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [width, height] = [842, 595];
  const margin = 28;
  const rowHeight = 16;
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");

  let page: PDFPage | undefined;
  let y = 0;
  let pageNo = 0;
  const newPage = () => {
    page = pdf.addPage([width, height]);
    pageNo += 1;
    y = height - margin;
    page.drawText("Standard Price", { x: margin, y: y - 14, size: 14, font: bold, color: rgb(0.12, 0.23, 0.54) });
    page.drawText(`${rows.length} items${filter.search ? ` · search "${filter.search}"` : ""} · generated ${generated} UTC · page ${pageNo}`, {
      x: margin,
      y: y - 28,
      size: 8,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
    y -= 44;
    page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: width - margin * 2, height: rowHeight, color: rgb(0.86, 0.92, 0.99) });
    let x = margin + 4;
    for (const column of PDF_COLUMNS) {
      const text = fit(column.header, bold, 8, column.width - 6);
      const tx = column.align === "right" ? x + column.width - 6 - bold.widthOfTextAtSize(text, 8) : x;
      page.drawText(text, { x: tx, y: y - 8, size: 8, font: bold, color: rgb(0.12, 0.23, 0.54) });
      x += column.width;
    }
    y -= rowHeight;
  };

  newPage();
  if (rows.length === 0) page!.drawText("No items to show.", { x: margin + 4, y: y - 10, size: 9, font });
  rows.forEach((row, index) => {
    if (y < margin + rowHeight) newPage();
    if (index % 2 === 1) page!.drawRectangle({ x: margin, y: y - rowHeight + 4, width: width - margin * 2, height: rowHeight, color: rgb(0.97, 0.98, 0.99) });
    let x = margin + 4;
    for (const column of PDF_COLUMNS) {
      const text = fit(cellOf(row, column.key, index), font, 8, column.width - 6);
      const tx = column.align === "right" ? x + column.width - 6 - font.widthOfTextAtSize(text, 8) : x;
      page!.drawText(text, { x: tx, y: y - 8, size: 8, font, color: rgb(0.06, 0.09, 0.16) });
      x += column.width;
    }
    y -= rowHeight;
  });
  return pdf.save();
}
