import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { cellText, describe, parseFlag } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { CustomerPriceInput, GroupPriceInput, PriceImportResult, PriceTab } from "../schemas/customer-price.schema";
import { customerPriceWhere, groupPriceWhere, saveCustomerPrice, saveGroupPrice, unitScope } from "./customer-price.service";

/**
 * Excel download, bulk upload and PDF print for Customer Price Setup. Files are
 * flat: one row per item price.
 */

const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
const money = (value: { toString(): string } | null) => (value === null ? "" : Number(value.toString()).toFixed(2));
const qty = (value: { toString(): string } | null) => (value === null ? "" : value.toString());

const CUSTOMER_COLUMNS = [
  { key: "customerCode", header: "Customer Code *", width: 16 },
  { key: "customerName", header: "Customer Name", width: 30 },
  { key: "priceType", header: "Price Type", width: 16 },
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "itemName", header: "Item Name", width: 30 },
  { key: "dpPrice", header: "DP Price *", width: 12 },
  { key: "tpPrice", header: "TP Price *", width: 12 },
] as const;

const GROUP_COLUMNS = [
  { key: "office", header: "Office *", width: 20 },
  { key: "customerGroup", header: "Customer Group *", width: 20 },
  { key: "priceType", header: "Price Type", width: 16 },
  { key: "createDate", header: "Create Date (YYYY-MM-DD) *", width: 22 },
  { key: "circularNo", header: "Circular/Notice", width: 18 },
  { key: "remarks", header: "Remarks", width: 24 },
  { key: "isRunning", header: "Is Price Running", width: 15 },
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "itemName", header: "Item Name", width: 28 },
  { key: "fromDate", header: "From Date", width: 12 },
  { key: "toDate", header: "To Date", width: 12 },
  { key: "fromQty", header: "From Qty", width: 10 },
  { key: "toQty", header: "To Qty", width: 10 },
  { key: "dpPrice", header: "DP Price *", width: 12 },
  { key: "tpPrice", header: "TP Price *", width: 12 },
] as const;

const columnsFor = (tab: PriceTab) => (tab === "customer" ? CUSTOMER_COLUMNS : GROUP_COLUMNS);

// ─── Rows (shared by Excel and PDF) ───────────────────────────────────────────

async function exportRows(actor: Actor, tab: PriceTab, search?: string): Promise<Record<string, string>[]> {
  if (tab === "customer") {
    const setups = await db().customerPriceSetup.findMany({
      where: customerPriceWhere(actor, search),
      orderBy: [{ customer: { name: "asc" } }],
      take: 2000,
      include: {
        customer: { select: { code: true, name: true } },
        priceList: { select: { name: true } },
        lines: { orderBy: { sortOrder: "asc" }, include: { item: { select: { code: true, name: true } } } },
      },
    });
    return setups.flatMap((setup) =>
      setup.lines.map((line) => ({
        customerCode: setup.customer.code,
        customerName: setup.customer.name,
        priceType: setup.priceList?.name ?? "",
        itemCode: line.item.code,
        itemName: line.item.name,
        dpPrice: money(line.dpPrice),
        tpPrice: money(line.tpPrice),
      })),
    );
  }
  const setups = await db().customerGroupPriceSetup.findMany({
    where: groupPriceWhere(actor, search),
    orderBy: [{ createDate: "desc" }],
    take: 2000,
    include: {
      office: { select: { name: true } },
      customerGroup: { select: { name: true } },
      priceList: { select: { name: true } },
      lines: { orderBy: { sortOrder: "asc" }, include: { item: { select: { code: true, name: true } } } },
    },
  });
  return setups.flatMap((setup) =>
    setup.lines.map((line) => ({
      office: setup.office.name,
      customerGroup: setup.customerGroup.name,
      priceType: setup.priceList?.name ?? "",
      createDate: dateOnly(setup.createDate),
      circularNo: setup.circularNo ?? "",
      remarks: setup.remarks ?? "",
      isRunning: setup.isRunning ? "Yes" : "No",
      itemCode: line.item.code,
      itemName: line.item.name,
      fromDate: dateOnly(line.fromDate),
      toDate: dateOnly(line.toDate),
      fromQty: qty(line.fromQty),
      toQty: qty(line.toQty),
      dpPrice: money(line.dpPrice),
      tpPrice: money(line.tpPrice),
    })),
  );
}

function sheetFor(workbook: ExcelJS.Workbook, tab: PriceTab) {
  const sheet = workbook.addWorksheet(tab === "customer" ? "Customer Price" : "Customer Group Price", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columnsFor(tab).map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF1E3A8A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  return sheet;
}

export async function exportPrices(actor: Actor, tab: PriceTab, search?: string): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = sheetFor(workbook, tab);
  for (const row of await exportRows(actor, tab, search)) sheet.addRow(row);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function priceTemplate(tab: PriceTab): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  sheetFor(workbook, tab);
  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 110 }];
  (tab === "customer"
    ? [
        "One row per item price. Columns marked * are required; Customer Name and Item Name are for reading only.",
        "Rows are grouped by customer and price type. An existing setup for that pair gets these items added or updated.",
      ]
    : [
        "One row per item price. Columns marked * are required; Item Name is for reading only.",
        "Rows with the same Office, Customer Group, Price Type, Create Date and Circular/Notice become one setup.",
        "Dates as YYYY-MM-DD. Is Price Running: Yes/No (empty = Yes).",
      ]
  ).forEach((line) => help.addRow([line]));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

// ─── Upload ───────────────────────────────────────────────────────────────────

const normal = (value: string) => value.trim().toLowerCase().replace(/\s*\*$/, "");

async function readSheet(bytes: Uint8Array, tab: PriceTab) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");
  const columns = columnsFor(tab);
  const index = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const match = columns.find((c) => normal(c.header) === normal(cellText(cell.value)));
    if (match) index.set(match.key, column);
  });
  for (const required of columns.filter((c) => c.header.endsWith("*"))) {
    if (!index.has(required.key)) throw new AppError(400, "VALIDATION_ERROR", `Column "${required.header}" is missing. Use the template.`);
  }
  const rows: { row: number; get: (key: string) => string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (key: string) => {
      const column = index.get(key);
      return column ? cellText(row.getCell(column).value) : "";
    };
    if (columns.every((c) => get(c.key) === "")) return;
    rows.push({ row: rowNumber, get });
  });
  if (rows.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The sheet has no price rows.");
  if (rows.length > 5000) throw new AppError(400, "VALIDATION_ERROR", "Upload at most 5000 rows per file.");
  return rows;
}

export async function importPrices(actor: Actor, tab: PriceTab, bytes: Uint8Array): Promise<PriceImportResult> {
  const rows = await readSheet(bytes, tab);
  const unit = { businessUnit: unitScope(actor) };
  const [items, priceLists, customers, offices, groups] = await Promise.all([
    db().item.findMany({ where: unit, select: { id: true, code: true, businessUnitId: true } }),
    db().priceList.findMany({ where: unit, select: { id: true, name: true, businessUnitId: true } }),
    db().customer.findMany({ where: unit, select: { id: true, code: true, businessUnitId: true } }),
    db().office.findMany({ where: unit, select: { id: true, name: true, businessUnitId: true } }),
    db().customerGroup.findMany({ where: unit, select: { id: true, name: true, businessUnitId: true } }),
  ]);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const result: PriceImportResult = { created: 0, updated: 0, errors: [] };

  // Rows are resolved first, then grouped into setups.
  const groupsByKey = new Map<string, { rows: number[]; head: Record<string, string | boolean>; lines: Record<string, string>[] }>();
  for (const { row, get } of rows) {
    try {
      let unitId: string;
      let head: Record<string, string | boolean>;
      if (tab === "customer") {
        const customer = customers.find((c) => same(c.code, get("customerCode")));
        if (!customer) throw new Error(`Customer code "${get("customerCode")}" not found.`);
        unitId = customer.businessUnitId;
        head = { businessUnitId: unitId, customerId: customer.id, priceListId: "" };
      } else {
        const office = offices.find((o) => same(o.name, get("office")));
        if (!office) throw new Error(`Office "${get("office")}" not found.`);
        unitId = office.businessUnitId;
        const group = groups.find((g) => same(g.name, get("customerGroup")) && g.businessUnitId === unitId);
        if (!group) throw new Error(`Customer group "${get("customerGroup")}" not found.`);
        head = {
          businessUnitId: unitId,
          officeId: office.id,
          customerGroupId: group.id,
          priceListId: "",
          createDate: get("createDate"),
          circularNo: get("circularNo"),
          remarks: get("remarks"),
          isRunning: get("isRunning") === "" ? true : parseFlag(get("isRunning"), "Is Price Running"),
        };
      }
      if (get("priceType")) {
        const list = priceLists.find((p) => same(p.name, get("priceType")) && p.businessUnitId === unitId);
        if (!list) throw new Error(`Price type "${get("priceType")}" not found.`);
        head.priceListId = list.id;
      }
      const item = items.find((i) => same(i.code, get("itemCode")) && i.businessUnitId === unitId);
      if (!item) throw new Error(`Item code "${get("itemCode")}" not found.`);
      const line: Record<string, string> =
        tab === "customer"
          ? { itemId: item.id, dpPrice: get("dpPrice"), tpPrice: get("tpPrice") }
          : { itemId: item.id, fromDate: get("fromDate"), toDate: get("toDate"), fromQty: get("fromQty"), toQty: get("toQty"), dpPrice: get("dpPrice"), tpPrice: get("tpPrice") };
      const key = JSON.stringify(head);
      const entry = groupsByKey.get(key) ?? { rows: [], head, lines: [] };
      entry.rows.push(row);
      entry.lines.push(line);
      groupsByKey.set(key, entry);
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }

  for (const entry of groupsByKey.values()) {
    try {
      if (tab === "customer") {
        // Merge into an existing setup for the same customer and price type.
        const existing = await db().customerPriceSetup.findFirst({
          where: { customerId: String(entry.head.customerId), priceListId: entry.head.priceListId ? String(entry.head.priceListId) : null },
          include: { lines: true },
        });
        const merged = new Map((existing?.lines ?? []).map((l) => [l.itemId, { itemId: l.itemId, dpPrice: l.dpPrice.toString(), tpPrice: l.tpPrice.toString() }]));
        for (const line of entry.lines) merged.set(line.itemId, line as { itemId: string; dpPrice: string; tpPrice: string });
        await saveCustomerPrice(actor, { ...entry.head, lines: [...merged.values()] } as unknown as CustomerPriceInput, existing?.id);
        if (existing) result.updated += 1;
        else result.created += 1;
      } else {
        await saveGroupPrice(actor, { ...entry.head, lines: entry.lines } as unknown as GroupPriceInput);
        result.created += 1;
      }
    } catch (error) {
      for (const row of entry.rows) result.errors.push({ row, message: describe(error) });
    }
  }
  result.errors.sort((a, b) => a.row - b.row);
  return result;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

const PDF_COLUMNS: Record<PriceTab, { key: string; header: string; width: number; align?: "right" }[]> = {
  customer: [
    { key: "customerCode", header: "Customer Code", width: 85 },
    { key: "customerName", header: "Customer Name", width: 190 },
    { key: "priceType", header: "Price Type", width: 90 },
    { key: "itemCode", header: "Item Code", width: 80 },
    { key: "itemName", header: "Item Name", width: 190 },
    { key: "dpPrice", header: "DP Price", width: 70, align: "right" },
    { key: "tpPrice", header: "TP Price", width: 70, align: "right" },
  ],
  group: [
    { key: "office", header: "Office", width: 80 },
    { key: "customerGroup", header: "Group", width: 75 },
    { key: "createDate", header: "Created", width: 60 },
    { key: "circularNo", header: "Circular", width: 60 },
    { key: "itemCode", header: "Item Code", width: 62 },
    { key: "itemName", header: "Item Name", width: 135 },
    { key: "fromDate", header: "From", width: 58 },
    { key: "toDate", header: "To", width: 58 },
    { key: "fromQty", header: "From Qty", width: 45, align: "right" },
    { key: "toQty", header: "To Qty", width: 45, align: "right" },
    { key: "dpPrice", header: "DP", width: 54, align: "right" },
    { key: "tpPrice", header: "TP", width: 54, align: "right" },
  ],
};

function fit(text: string, font: PDFFont, size: number, width: number) {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** A4 landscape table of the current list (search applied). */
export async function pricePdf(actor: Actor, tab: PriceTab, search?: string): Promise<Uint8Array> {
  const rows = await exportRows(actor, tab, search);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const columns = PDF_COLUMNS[tab];
  const [width, height] = [842, 595];
  const margin = 32;
  const rowHeight = 16;
  const title = tab === "customer" ? "Customer Price" : "Customer Group Price";
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");

  let page: PDFPage | undefined;
  let y = 0;
  let pageNo = 0;
  const newPage = () => {
    page = pdf.addPage([width, height]);
    pageNo += 1;
    y = height - margin;
    page.drawText(title, { x: margin, y: y - 14, size: 14, font: bold, color: rgb(0.12, 0.23, 0.54) });
    page.drawText(`${rows.length} rows${search ? ` · search "${search}"` : ""} · generated ${generated} UTC · page ${pageNo}`, {
      x: margin,
      y: y - 28,
      size: 8,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
    y -= 44;
    // Header band.
    page.drawRectangle({ x: margin, y: y - rowHeight + 4, width: width - margin * 2, height: rowHeight, color: rgb(0.86, 0.92, 0.99) });
    let x = margin + 4;
    for (const column of columns) {
      const text = fit(column.header, bold, 8, column.width - 6);
      const tx = column.align === "right" ? x + column.width - 6 - bold.widthOfTextAtSize(text, 8) : x;
      page.drawText(text, { x: tx, y: y - 8, size: 8, font: bold, color: rgb(0.12, 0.23, 0.54) });
      x += column.width;
    }
    y -= rowHeight;
  };

  newPage();
  if (rows.length === 0) page!.drawText("No prices to show.", { x: margin + 4, y: y - 10, size: 9, font });
  rows.forEach((row, index) => {
    if (y < margin + rowHeight) newPage();
    if (index % 2 === 1) page!.drawRectangle({ x: margin, y: y - rowHeight + 4, width: width - margin * 2, height: rowHeight, color: rgb(0.97, 0.98, 0.99) });
    let x = margin + 4;
    for (const column of columns) {
      const text = fit(row[column.key] ?? "", font, 8, column.width - 6);
      const tx = column.align === "right" ? x + column.width - 6 - font.widthOfTextAtSize(text, 8) : x;
      page!.drawText(text, { x: tx, y: y - 8, size: 8, font, color: rgb(0.06, 0.09, 0.16) });
      x += column.width;
    }
    y -= rowHeight;
  });
  return pdf.save();
}
