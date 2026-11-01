import ExcelJS from "exceljs";
import type { Actor } from "@/lib/auth/actor";
import { addPageFooters, pdfWriter } from "@/lib/pdf";
import { altQty } from "../../orders/lib/order-totals";
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "../../orders/schemas/order.schema";
import { APPROVED_ORDER_STATUS_LABELS, CONFIRMATION_LABELS, DELIVERY_TYPE_LABELS } from "../schemas/delivery.schema";
import { getDelivery, listApprovedOrders, listDeliveries } from "./delivery.service";

export const DELIVERY_EXPORT_TABS = ["approved", "deliveries", "exchanges", "challans"] as const;
export type DeliveryExportTab = (typeof DELIVERY_EXPORT_TABS)[number];

const day = (value: string | null) => (value ? value.split("-").reverse().join("-") : "");
const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
type Cell = string | number;
const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 3 });

/** One sheet: blue header row, bordered rows, a bold total under the money column. */
async function workbook(name: string, columns: [string, number][], rows: Cell[][], moneyColumns: number[]): Promise<Uint8Array> {
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
  for (const column of moneyColumns) total[column] = Math.round(rows.reduce((sum, row) => sum + Number(row[column] || 0), 0) * 100) / 100;
  sheet.addRow(total).font = { bold: true };
  columns.forEach(([, width], index) => (sheet.getColumn(index + 1).width = width));
  for (const column of moneyColumns) sheet.getColumn(column + 1).numFmt = "#,##0.00";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return new Uint8Array(await book.xlsx.writeBuffer());
}

/** A Sales Delivery tab (same filters as the screen) as .xlsx. */
export async function deliveryTabExcel(actor: Actor, tab: DeliveryExportTab, raw: Record<string, string>): Promise<Uint8Array> {
  if (tab === "approved") {
    const rows = await listApprovedOrders(actor, raw);
    return workbook(
      "Approved SO",
      [
        ["SL", 6],
        ["Status", 18],
        ["SO Date", 12],
        ["Exp. Delivery Date", 14],
        ["SO No", 18],
        ["Office Name", 22],
        ["Customer Code", 16],
        ["Customer Name", 30],
        ["Shipping Address", 36],
        ["Zone", 14],
        ["Route", 14],
        ["Section", 14],
        ["Customer PO/Ref", 16],
        ["Order By", 20],
        ["Territory", 16],
        ["Type", 9],
        ["Delivered %", 11],
        ["Pending Reason", 24],
        ["Amount", 15],
      ],
      rows.map((row, index) => [
        index + 1,
        APPROVED_ORDER_STATUS_LABELS[row.status],
        day(row.orderDate),
        day(row.expectedDeliveryDate),
        row.number,
        row.officeName,
        row.customerCode,
        row.customerName,
        row.shippingAddress ?? "",
        row.zone ?? "",
        row.route ?? "",
        row.section ?? "",
        row.refCustomerPo ?? "",
        row.salesPersonName ?? "",
        row.territory ?? "",
        ORDER_TYPE_LABELS[row.orderType],
        row.deliveredPercent,
        row.pendingReasonName ?? "",
        row.salesTotal,
      ]),
      [18],
    );
  }
  const filters = tab === "exchanges" ? { ...raw, deliveryType: "EXCHANGE" } : raw;
  const { rows } = await listDeliveries(actor, filters);
  return workbook(
    tab === "exchanges" ? "Exchange List" : tab === "challans" ? "Challan List" : "Delivery List",
    [
      ["SL", 6],
      ["Invoice", 18],
      ["Challan No", 16],
      ["VAT Challan No", 16],
      ["Type", 10],
      ["Confirmation", 13],
      ["Delivery Date", 13],
      ["SO No", 18],
      ["Office", 22],
      ["Sales Force", 20],
      ["Vehicle No", 14],
      ["Customer Code", 16],
      ["Customer", 30],
      ["Project/Outlet/Ref", 18],
      ["Shipping Address", 36],
      ["Zone", 14],
      ["Route", 14],
      ["Section", 14],
      ["Payment Method", 14],
      ["Total Amount", 15],
      ["Return Amount", 15],
      ["Paid", 14],
      ["Pending Amount", 15],
    ],
    rows.map((row, index) => [
      index + 1,
      row.number,
      row.challanNo ?? "",
      row.vatChallanNo ?? "",
      DELIVERY_TYPE_LABELS[row.deliveryType],
      row.deleted ? "Deleted" : CONFIRMATION_LABELS[row.confirmation],
      day(row.deliveryDate),
      row.orderNumber ?? "",
      row.officeName ?? "",
      row.salesPersonName ?? "",
      row.vehicleNo ?? "",
      row.customerCode,
      row.customerName,
      row.refProjectOutlet ?? "",
      row.shippingAddress ?? "",
      row.zone ?? "",
      row.route ?? "",
      row.section ?? "",
      PAYMENT_METHOD_LABELS[row.paymentMethod],
      row.totalAmount,
      row.returnAmount,
      row.paidAmount,
      row.pendingAmount,
    ]),
    [19, 20, 21, 22],
  );
}

/** Delivery Challan as an A4 PDF: who gets what, in units and packs, with signature blocks. */
export async function deliveryChallanPdf(actor: Actor, id: string): Promise<{ number: string; bytes: Uint8Array }> {
  const delivery = await getDelivery(actor, id);
  const challan = delivery.challanNo ?? delivery.number;
  const { doc, pdf } = await pdfWriter(false);
  pdf.title(delivery.companyName);
  if (delivery.officeName) pdf.text(`${delivery.officeName}${delivery.officeAddress ? ` - ${delivery.officeAddress}` : ""}`);
  pdf.heading(`Delivery Challan #${challan}`);
  pdf.pairs([
    ["Date", day(delivery.deliveryDate)],
    ["Sales Order No", delivery.orderNumber ?? "-"],
    ["Sales Invoice No", delivery.number],
    ["PO/Ref", delivery.refCustomerPo ?? "-"],
  ]);
  pdf.heading("Billing / Shipping");
  pdf.pairs([
    ["Name", delivery.buyerName ? `${delivery.customerName} (${delivery.buyerName})` : delivery.customerName],
    ["Contact To", [delivery.contactPerson, delivery.buyerMobile].filter(Boolean).join(" - ") || "-"],
    ["Customer Code", delivery.customerCode],
    ["Shipping Address", delivery.shippingAddress ?? "-"],
    ["Mobile", delivery.customerPhone ?? "-"],
    ["Project/Outlet/Ref.", delivery.refProjectOutlet ?? "-"],
    ["Billing Address", delivery.billingAddress ?? "-"],
    ["Delivery Type", delivery.orderFullyDelivered === null ? "Direct" : delivery.orderFullyDelivered ? "Fully Delivered" : "Partially Delivered"],
    ["Sales By", delivery.salesPersonName ?? "-"],
    ["Vehicle No", delivery.vehicleNo ?? "-"],
  ]);
  const altTotal = delivery.lines.reduce((sum, line) => sum + (altQty(line.qty, line.altUomFactor) ?? 0), 0);
  pdf.table(
    [
      { header: "SL", width: 3, align: "right" },
      { header: "Code/SKU", width: 9 },
      { header: "Item Name & Description", width: 26 },
      { header: "UOM", width: 5 },
      { header: "Alt. UOM", width: 6 },
      { header: "Qty", width: 9, align: "right" },
      { header: "Alt. Qty", width: 10, align: "right" },
    ],
    delivery.lines.map((line) => {
      const alt = altQty(line.qty, line.altUomFactor);
      // Packs and loose units, e.g. 300 PCS at 24/Ctn -> "12-12".
      const packs = line.altUomFactor ? `${Math.floor(line.qty / line.altUomFactor)}-${Math.round((line.qty % line.altUomFactor) * 1000) / 1000}` : "";
      return [
        String(line.lineNo),
        line.itemCode,
        line.itemName,
        line.uom ?? "",
        line.altUom ?? "",
        qty(line.qty),
        alt === null ? "" : `${qty(alt)} (${packs})`,
      ];
    }),
    [["", "", "Total", "", "", qty(delivery.totalQty), qty(Math.round(altTotal * 1000) / 1000)]],
  );
  pdf.text(`Terms & Condition: ${delivery.terms?.replace(/\s+/g, " ") ?? ""}`);
  pdf.text(`Remarks: ${delivery.remarks ?? "N/A"} [VAT ${delivery.priceIncludesVat ? "Inclusive" : "Exclusive"}]`);
  pdf.space(60);
  pdf.pairs([
    ["Authorized Signature", "________________"],
    ["Receiver's Signature", "________________"],
    ["Delivered By", delivery.createdBy ?? "-"],
    ["Goods Received in Good Condition", ""],
  ]);
  await addPageFooters(doc, `System generated report, hence no signature required. ${challan}`);
  return { number: challan, bytes: await doc.save() };
}
