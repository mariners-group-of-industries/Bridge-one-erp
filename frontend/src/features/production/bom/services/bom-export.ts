import ExcelJS from "exceljs";
import type { Actor } from "@/lib/auth/actor";
import { pdfWriter } from "../../lib/pdf";
import { BOM_TYPE_LABELS, OUTPUT_TYPE_LABELS, WASTAGE_TYPE_LABELS, type BomDetail, type BomRow } from "../schemas/bom.schema";
import { getBom, listBoms } from "./bom.service";

const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });
/** DD-MM-YYYY in Bangladesh time. */
const day = (iso: string) => {
  const [year, month, date] = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).split("-");
  return `${date}-${month}-${year}`;
};

/** List columns shared by the Excel and PDF exports; `details` gives one row per production item. */
function listTable(rows: BomRow[], details: boolean) {
  const headers = ["SL", "Date", "BOM Name", "Item Name", "Department", "Section", "UoM", "Alt. UoM", "Lot Size", "Tolerance (%)", "BOM Value", "Created By", "Status"];
  const body: (string | number)[][] = [];
  for (const row of rows) {
    const outputs = details ? row.outputs : row.outputs.slice(0, 1);
    for (const output of outputs.length ? outputs : [undefined]) {
      body.push([
        body.length + 1,
        day(row.createdAt),
        row.name,
        output ? `${output.code} - ${output.name}${!details && row.outputs.length > 1 ? ` (+${row.outputs.length - 1})` : ""}` : "",
        row.departmentName ?? "",
        row.sectionName ?? "",
        output?.uom ?? "",
        output?.altUom ?? "",
        details && output ? output.lotSizeQty : row.lotSize,
        row.tolerancePercent ?? "",
        row.totalCost,
        row.createdByName,
        row.isActive ? "Active" : "Inactive",
      ]);
    }
  }
  return { headers, body };
}

export async function bomListExcel(actor: Actor, raw: Record<string, string>): Promise<Uint8Array> {
  const { details, ...filters } = raw;
  const { headers, body } = listTable(await listBoms(actor, filters), details === "true");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bill Of Material");
  sheet.addRow(headers).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  for (const row of body) sheet.addRow(row);
  const widths = [6, 12, 34, 44, 16, 18, 8, 9, 10, 12, 14, 20, 10];
  widths.forEach((width, index) => (sheet.getColumn(index + 1).width = width));
  sheet.getColumn(11).numFmt = "#,##0.00";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const total = body.reduce((sum, row) => sum + Number(row[10]), 0);
  const footer = sheet.addRow(["", "", "Total", "", "", "", "", "", "", "", Math.round(total * 100) / 100, "", ""]);
  footer.font = { bold: true };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function bomListPdf(actor: Actor, raw: Record<string, string>): Promise<Uint8Array> {
  const { details, ...filters } = raw;
  const rows = await listBoms(actor, filters);
  const { headers, body } = listTable(rows, details === "true");
  const { doc, pdf } = await pdfWriter(true);
  pdf.title("Bill Of Material");
  const widths = [4, 8, 20, 26, 10, 11, 5, 6, 7, 7, 10, 12, 7];
  const right = new Set([0, 8, 9, 10]);
  pdf.table(
    headers.map((header, index) => ({ header, width: widths[index], align: right.has(index) ? "right" : "left" })),
    body.map((row) => row.map((cell, index) => (index === 10 ? money(Number(cell)) : String(cell)))),
    [["", "", "Total", "", "", "", "", "", "", "", money(body.reduce((sum, row) => sum + Number(row[10]), 0)), "", ""]],
  );
  return doc.save();
}

/** "Bill Of Material Details" as a PDF. */
export async function bomDetailPdf(actor: Actor, id: string): Promise<{ name: string; bytes: Uint8Array }> {
  const bom: BomDetail = await getBom(actor, id);
  const { doc, pdf } = await pdfWriter(true);
  pdf.title("Bill Of Material Details");
  pdf.pairs([
    ["BOM Name", bom.name],
    ["BOM Type", BOM_TYPE_LABELS[bom.bomType]],
    ["Department", bom.departmentName ?? "-"],
    ["Section", bom.sectionName ?? "-"],
    ["Lot Size", qty(bom.lotSize)],
    ["Tolerance (%)", bom.tolerancePercent === null ? "-" : qty(bom.tolerancePercent)],
    ["Created By", bom.createdByName],
    ["Date", day(bom.createdAt)],
  ]);

  pdf.heading("Production Items");
  pdf.table(
    [
      { header: "SL", width: 4, align: "right" },
      { header: "Item", width: 40 },
      { header: "Item Type", width: 14 },
      { header: "Net Weight", width: 10, align: "right" },
      { header: "Lot Size/Quantity", width: 12, align: "right" },
      { header: "Total Weight", width: 10, align: "right" },
      { header: "Tolerance (%)", width: 9, align: "right" },
      { header: "Cost (%)", width: 8, align: "right" },
      { header: "Primary", width: 7 },
    ],
    bom.outputLines.map((line, index) => [
      String(index + 1),
      `${line.code} - ${line.name} (${line.uom})`,
      OUTPUT_TYPE_LABELS[line.outputType],
      qty(line.netWeight),
      qty(line.lotSizeQty),
      qty(line.totalWeight),
      line.tolerancePercent === null ? "-" : qty(line.tolerancePercent),
      qty(line.costPercent),
      line.isPrimary ? "Yes" : "No",
    ]),
  );

  pdf.heading("Input Materials", `Material Total : ${money(bom.materialCost)}`);
  const materialQty = bom.materials.reduce((sum, line) => sum + line.qty, 0);
  const materialTotalQty = bom.materials.reduce((sum, line) => sum + line.totalQty, 0);
  pdf.table(
    [
      { header: "SL", width: 4, align: "right" },
      { header: "Materials", width: 34 },
      { header: "Type", width: 12 },
      { header: "Excl. Scrap", width: 7 },
      { header: "Alt. Qty", width: 8, align: "right" },
      { header: "Quantity", width: 9, align: "right" },
      { header: "Wastage (%)", width: 8, align: "right" },
      { header: "Total Qty", width: 9, align: "right" },
      { header: "Avg. Rate", width: 9, align: "right" },
      { header: "Total", width: 11, align: "right" },
    ],
    bom.materials.map((line, index) => [
      String(index + 1),
      `${line.code} - ${line.name} (${line.uom})`,
      line.materialType ?? "-",
      line.excludeFromScrap ? "Yes" : "No",
      line.altQty === null ? "-" : `${qty(line.altQty)} ${line.altUom ?? ""}`,
      qty(line.qty),
      qty(line.wastagePercent),
      qty(line.totalQty),
      money(line.rate),
      money(line.amount),
    ]),
    [
      ["", "Total Of Raw Material", "", "", "", qty(materialQty), "", qty(materialTotalQty), "", money(bom.materialCost)],
      ...(bom.overheadCost ? [["", "Overhead", "", "", "", "", "", "", "", money(bom.overheadCost)]] : []),
      ["", "Grand Total", "", "", "", qty(materialQty), "", qty(materialTotalQty), "", money(bom.totalCost)],
    ],
  );

  if (bom.wastages.length) {
    pdf.heading("Other / Wastage Output");
    pdf.table(
      [
        { header: "SL", width: 4, align: "right" },
        { header: "Item", width: 34 },
        { header: "Item Type", width: 12 },
        { header: "Output Type", width: 10 },
        { header: "Ratio Qty (%)", width: 9, align: "right" },
        { header: "Expected Qty", width: 10, align: "right" },
        { header: "Mandatory", width: 8 },
        { header: "With Net Wt.", width: 8 },
        { header: "With Runner", width: 8 },
      ],
      bom.wastages.map((line, index) => [
        String(index + 1),
        `${line.code} - ${line.name} (${line.uom})`,
        line.itemType ?? "-",
        WASTAGE_TYPE_LABELS[line.outputType],
        qty(line.ratioPercent),
        qty(line.expectedQty),
        line.isMandatory ? "Yes" : "No",
        line.calcWithNetWeight ? "Yes" : "No",
        line.calcWithProcessRunner ? "Yes" : "No",
      ]),
    );
  }
  if (bom.overheads.length) {
    pdf.heading("Overheads");
    pdf.table(
      [
        { header: "SL", width: 4, align: "right" },
        { header: "Account Code", width: 14 },
        { header: "Account Name", width: 50 },
        { header: "Percentage", width: 12, align: "right" },
        { header: "Amount", width: 18, align: "right" },
      ],
      bom.overheads.map((line, index) => [String(index + 1), line.accountCode, line.accountName, line.percentage === null ? "-" : `${qty(line.percentage)}%`, money(line.amount)]),
      [["", "", "Total Overhead", "", money(bom.overheadCost)]],
    );
  }
  if (bom.children.length) {
    pdf.heading("Child BOM");
    pdf.table(
      [
        { header: "SL", width: 4, align: "right" },
        { header: "Child BOM", width: 60 },
        { header: "Stage/Level", width: 20 },
        { header: "BOM Value", width: 16, align: "right" },
      ],
      bom.children.map((link, index) => [String(index + 1), link.name, link.stage, money(link.totalCost)]),
    );
  }
  return { name: bom.name, bytes: await doc.save() };
}
