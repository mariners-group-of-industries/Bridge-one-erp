import ExcelJS from "exceljs";
import type { Actor } from "@/lib/auth/actor";
import { addPageFooters, pdfWriter } from "@/lib/pdf";
import { amountInWords } from "../../lib/amount-in-words";
import { altQty } from "../lib/order-totals";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, orderListQuerySchema, type OrderDetail } from "../schemas/order.schema";
import { getOrder, listOrders } from "./order.service";

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 3 });
const day = (value: string | null) => (value ? value.split("-").reverse().join("-") : "");
const remainingQty = (order: OrderDetail) => order.lines.reduce((sum, line) => sum + line.qty - line.deliveredQty, 0);

/** The financial summary under the items (view page, PDF and Excel). */
function summary(order: OrderDetail): [string, string][] {
  const rows: [string, string][] = [
    ["Item Price (without VAT)", money(order.itemsBase)],
    ["Total VAT", money(order.vatAmount)],
  ];
  if (order.aitAmount) rows.push(["Total AIT", money(order.aitAmount)]);
  if (order.discountAmount) rows.push(["Discount", `-${money(order.discountAmount)}`]);
  if (order.deliveryCharge) rows.push(["Delivery Charge", money(order.deliveryCharge)]);
  if (order.unloadingCharge) rows.push(["Unloading Charge", money(order.unloadingCharge)]);
  rows.push(["Sales Total", money(order.salesTotal)]);
  return rows;
}

/** The sales order as an A4 landscape PDF to print or send. */
export async function orderPdf(actor: Actor, id: string): Promise<{ number: string; bytes: Uint8Array }> {
  const order = await getOrder(actor, id);
  const { doc, pdf } = await pdfWriter(true);
  pdf.title(`${order.companyName} - Sales Order`);
  pdf.heading(`SO No. ${order.number}`, `Total ${money(order.salesTotal)}`);
  pdf.pairs([
    ["Office", order.officeName],
    ["SO Date", day(order.orderDate)],
    ["Exp. Delivery Date", day(order.expectedDeliveryDate)],
    ["Status", ORDER_STATUS_LABELS[order.status]],
    ["Customer", `${order.customerCode} - ${order.customerName}`],
    ["Customer Group", order.customerGroup ?? "-"],
    ["Territory", order.territory ?? "-"],
    ["Sales Force", order.salesPersonName ?? "-"],
    ["Billing Address", order.billingAddress ?? "-"],
    ["Shipping Address", order.shippingAddress ?? "-"],
    ["Customer PO/Ref.", [order.refCustomerPo, day(order.refCustomerPoDate)].filter(Boolean).join(", ") || "-"],
    ["Project/Outlet/Ref.", order.refProjectOutlet ?? "-"],
    ["Type / Payment", `${ORDER_TYPE_LABELS[order.orderType]} / ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`],
    ["VAT/SD/AIT", order.priceIncludesVat ? "Inclusive" : "Exclusive"],
  ]);

  pdf.heading("Item List");
  const blank = (label: string, value: string) => ["", "", label, "", "", "", "", "", "", "", "", value];
  pdf.table(
    [
      { header: "SL", width: 3, align: "right" },
      { header: "Code", width: 9 },
      { header: "Name", width: 24 },
      { header: "UOM", width: 5 },
      { header: "Quantity", width: 8, align: "right" },
      { header: "Alt. Qty", width: 8, align: "right" },
      { header: "Rem. Qty", width: 8, align: "right" },
      { header: "Price", width: 8, align: "right" },
      { header: "Disc %", width: 5, align: "right" },
      { header: "VAT %", width: 5, align: "right" },
      { header: "AIT %", width: 5, align: "right" },
      { header: "Total", width: 10, align: "right" },
    ],
    order.lines.map((line) => {
      const alt = altQty(line.qty, line.altUomFactor);
      return [
        String(line.lineNo),
        line.itemCode,
        line.itemName,
        line.uom,
        qty(line.qty),
        alt === null ? "" : `${qty(alt)} ${line.altUom ?? ""}`,
        qty(line.qty - line.deliveredQty),
        money(line.unitPrice),
        String(line.discountPercent),
        String(line.vatPercent),
        String(line.aitPercent),
        money(line.lineTotal),
      ];
    }),
    [
      ["", "", "Total", "", qty(order.totalQty), "", qty(remainingQty(order)), "", "", "", "", money(order.itemsTotal)],
      ...summary(order).map(([label, value]) => blank(label, value)),
    ],
  );
  pdf.text(`Amount in words: ${amountInWords(order.salesTotal)}`);
  if (order.remarks) pdf.text(`Remarks: ${order.remarks}`);
  if (order.terms) {
    pdf.heading("Terms & Conditions");
    for (const line of order.terms.split("\n").filter(Boolean)) pdf.text(line);
  }
  await addPageFooters(doc, `${order.number} · ${ORDER_STATUS_LABELS[order.status]}`);
  return { number: order.number, bytes: await doc.save() };
}

const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;

function sheetWith(workbook: ExcelJS.Workbook, name: string, columns: [string, number][]) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(columns.map(([label]) => label)).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = border;
  });
  columns.forEach(([, width], index) => (sheet.getColumn(index + 1).width = width));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return sheet;
}

/** The filtered order list (Order Management) as .xlsx. */
export async function ordersExcel(actor: Actor, raw: unknown): Promise<Uint8Array> {
  const { rows } = await listOrders(actor, orderListQuerySchema.parse(raw));
  const workbook = new ExcelJS.Workbook();
  const columns: [string, number][] = [
    ["SL", 6],
    ["Status", 11],
    ["SO Date", 12],
    ["Exp. Delivery Date", 14],
    ["SO NO", 18],
    ["Office Name", 22],
    ["Customer Code", 16],
    ["Customer Name", 30],
    ["Project/Outlet/Ref", 18],
    ["Shipping Address", 36],
    ["Zone", 14],
    ["Route", 14],
    ["Section", 14],
    ["Territory Name", 16],
    ["Sales Force", 20],
    ["Ref Customer PO", 16],
    ["Type", 9],
    ["Payment Method", 14],
    ["Pending Reason", 18],
    ["Amount (BDT)", 15],
  ];
  const sheet = sheetWith(workbook, "Sales Orders", columns);
  rows.forEach((row, index) =>
    sheet
      .addRow([
        index + 1,
        ORDER_STATUS_LABELS[row.status],
        day(row.orderDate),
        day(row.expectedDeliveryDate),
        row.number,
        row.officeName,
        row.customerCode,
        row.customerName,
        row.refProjectOutlet ?? "",
        row.shippingAddress ?? "",
        row.zone ?? "",
        row.route ?? "",
        row.section ?? "",
        row.territory ?? "",
        row.salesPersonName ?? "",
        row.refCustomerPo ?? "",
        ORDER_TYPE_LABELS[row.orderType],
        PAYMENT_METHOD_LABELS[row.paymentMethod],
        row.pendingReasonName ?? "",
        row.salesTotal,
      ])
      .eachCell({ includeEmpty: true }, (cell) => (cell.border = border)),
  );
  const total = Math.round(rows.reduce((sum, row) => sum + row.salesTotal, 0) * 100) / 100;
  sheet.addRow([...Array<string>(columns.length - 2).fill(""), "Total", total]).font = { bold: true };
  sheet.getColumn(columns.length).numFmt = "#,##0.00";
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** One order's item list with its totals, as .xlsx. */
export async function orderExcel(actor: Actor, id: string): Promise<{ number: string; bytes: Uint8Array }> {
  const order = await getOrder(actor, id);
  const workbook = new ExcelJS.Workbook();
  const sheet = sheetWith(workbook, order.number, [
    ["SL", 6],
    ["Code", 14],
    ["Name", 36],
    ["UOM", 8],
    ["Quantity", 12],
    ["Alt. UOM", 9],
    ["Alt. Quantity", 12],
    ["Rem. QTY", 12],
    ["Price", 12],
    ["Discount (%)", 11],
    ["VAT (%)", 9],
    ["AIT (%)", 9],
    ["Total", 15],
  ]);
  for (const line of order.lines) {
    sheet
      .addRow([
        line.lineNo,
        line.itemCode,
        line.itemName,
        line.uom,
        line.qty,
        line.altUom ?? "",
        altQty(line.qty, line.altUomFactor) ?? "",
        line.qty - line.deliveredQty,
        line.unitPrice,
        line.discountPercent,
        line.vatPercent,
        line.aitPercent,
        line.lineTotal,
      ])
      .eachCell({ includeEmpty: true }, (cell) => (cell.border = border));
  }
  sheet.addRow(["", "", "Total", "", order.totalQty, "", "", remainingQty(order), "", "", "", "", order.itemsTotal]).font = { bold: true };
  sheet.addRow([]);
  for (const [label, value] of summary(order)) sheet.addRow(["", "", label, "", "", "", "", "", "", "", "", "", value]);
  sheet.addRow(["", "", `Amount in words: ${amountInWords(order.salesTotal)}`]);
  for (const column of [5, 7, 8]) sheet.getColumn(column).numFmt = "#,##0.###";
  for (const column of [9, 13]) sheet.getColumn(column).numFmt = "#,##0.00";
  return { number: order.number, bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) };
}
