import ExcelJS from "exceljs";
import type { Actor } from "@/lib/auth/actor";
import { addPageFooters, pdfWriter } from "@/lib/pdf";
import { DELIVERY_TYPE_LABELS } from "../../deliveries/schemas/delivery.schema";
import { MARKET_STAGE_LABELS, RETURN_KIND_LABELS, RETURN_MODE_LABELS, RETURN_STATUS_LABELS } from "../schemas/return.schema";
import { getReturn, listReturnableDeliveries, listReturns } from "./return.service";

export const RETURN_EXPORT_TABS = ["deliveries", "returns", "market"] as const;
export type ReturnExportTab = (typeof RETURN_EXPORT_TABS)[number];

const day = (value: string | null) => (value ? value.split("-").reverse().join("-") : "");
const qty = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
type Cell = string | number;

async function workbook(name: string, columns: [string, number][], rows: Cell[][], sums: number[]): Promise<Uint8Array> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(name);
  sheet.addRow(columns.map(([label]) => label)).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = border;
  });
  for (const row of rows) sheet.addRow(row).eachCell({ includeEmpty: true }, (cell) => (cell.border = border));
  const total: Cell[] = columns.map(() => "");
  total[0] = "Total";
  for (const column of sums) total[column] = Math.round(rows.reduce((sum, row) => sum + Number(row[column] || 0), 0) * 100) / 100;
  sheet.addRow(total).font = { bold: true };
  columns.forEach(([, width], index) => (sheet.getColumn(index + 1).width = width));
  for (const column of sums) sheet.getColumn(column + 1).numFmt = "#,##0.00";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return new Uint8Array(await book.xlsx.writeBuffer());
}

/** A Sales Return tab (same filters as the screen) as .xlsx. */
export async function returnTabExcel(actor: Actor, tab: ReturnExportTab, raw: Record<string, string>): Promise<Uint8Array> {
  if (tab === "deliveries") {
    const rows = await listReturnableDeliveries(actor, raw);
    return workbook(
      "Delivery List",
      [
        ["SL", 6],
        ["Delivery Date", 13],
        ["Invoice No", 18],
        ["SO No", 18],
        ["Challan No", 18],
        ["Customer Code", 16],
        ["Customer", 30],
        ["Deli. QTY", 12],
        ["Ret. QTY", 12],
        ["Item Total", 15],
        ["Sales By", 22],
        ["Status", 10],
      ],
      rows.map((row, index) => [
        index + 1,
        day(row.deliveryDate),
        row.number,
        row.orderNumber ?? "",
        row.challanNo ?? "",
        row.customerCode,
        row.customerName,
        row.deliveredQty,
        row.returnedQty,
        row.totalAmount,
        row.salesPersonName ?? "",
        DELIVERY_TYPE_LABELS[row.deliveryType],
      ]),
      [7, 8, 9],
    );
  }
  const { rows } = await listReturns(actor, tab === "market" ? { ...raw, kind: "MARKET" } : raw);
  return workbook(
    tab === "market" ? "Market Return" : "Return List",
    [
      ["SL", 6],
      ["Return Date", 13],
      ["Invoice No", 18],
      ["Delivery No", 18],
      ["Customer Code", 16],
      ["Customer", 30],
      ["Project/Outlet/Ref", 18],
      ["Return Ref. No", 16],
      ["Return Req. No", 16],
      ["Return Qty", 12],
      ["Factory Rec. Qty", 14],
      ["QC Qty", 12],
      ["Return Amount", 15],
      ["Return Type", 22],
      ["Sales By", 22],
      ["Territory", 16],
      ["Type", 14],
      ["Status", 14],
    ],
    rows.map((row, index) => [
      index + 1,
      day(row.returnDate),
      row.number,
      row.deliveryNumber ?? "",
      row.customerCode,
      row.customerName,
      row.refProjectOutlet ?? "",
      row.refNo ?? "",
      row.requestNo ?? "",
      row.totalQty,
      row.receivedQty,
      row.qcQty,
      -row.totalAmount,
      RETURN_MODE_LABELS[row.mode],
      row.salesPersonName ?? "",
      row.territory ?? "",
      RETURN_KIND_LABELS[row.kind],
      row.kind === "MARKET" && row.status === "SUBMITTED" ? MARKET_STAGE_LABELS[row.marketStage] : RETURN_STATUS_LABELS[row.status],
    ]),
    [9, 10, 11, 12],
  );
}

/** Return Note/Challan as an A4 PDF: what came back, with signature blocks. */
export async function returnChallanPdf(actor: Actor, id: string): Promise<{ number: string; bytes: Uint8Array }> {
  const record = await getReturn(actor, id);
  const { doc, pdf } = await pdfWriter(false);
  pdf.title(record.companyName);
  if (record.officeName) pdf.text(`${record.officeName}${record.officeAddress ? ` - ${record.officeAddress}` : ""}`);
  pdf.heading("Return Note/Challan");
  pdf.pairs([
    ["Return Invoice No", record.number],
    ["Date", day(record.returnDate)],
    ["Challan No", record.challanNo ?? "-"],
    ["Invoice No", record.deliveryNumber ?? "-"],
  ]);
  pdf.heading("Billing / Shipping");
  pdf.pairs([
    ["Buyer Name", record.customerName],
    ["Address", record.shippingAddress ?? "-"],
    ["Buyer Address", record.customerAddress ?? "-"],
    ["Mobile", record.customerPhone ?? "-"],
    ["Buyer Mobile", record.customerPhone ?? "-"],
    ["Return Type", RETURN_MODE_LABELS[record.mode]],
    ["Return By", record.createdBy ?? "-"],
    ["Warehouse", record.warehouseName ?? "-"],
  ]);
  pdf.table(
    [
      { header: "SL", width: 3, align: "right" },
      { header: "Code/SKU", width: 10 },
      { header: "Item Name & Description", width: 32 },
      { header: "UOM", width: 6 },
      { header: "Quantity", width: 10, align: "right" },
    ],
    record.lines.map((line) => [String(line.lineNo), line.itemCode, line.itemName, line.uom ?? "", qty(-line.qty)]),
    [["", "", "", "Total :", qty(-record.totalQty)]],
  );
  pdf.text(`Remarks: ${record.remarks ?? ""}`);
  pdf.space(60);
  pdf.pairs([
    ["Authorized Signature", "________________"],
    ["Receiver's Signature", "________________"],
    ["Name", record.createdBy ?? "-"],
    ["Name", ""],
  ]);
  await addPageFooters(doc, `System generated report, hence no signature required. ${record.number}`);
  return { number: record.number, bytes: await doc.save() };
}
