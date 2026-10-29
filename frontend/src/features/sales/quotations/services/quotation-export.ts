import ExcelJS from "exceljs";
import type { Actor } from "@/lib/auth/actor";
import { addPageFooters, pdfWriter } from "@/lib/pdf";
import { richTextToPlain } from "@/lib/rich-text";
import { STATUS_LABELS, displayStatus, quotationListQuerySchema } from "../schemas/quotation.schema";
import { getQuotation, listQuotations } from "./quotation.service";

const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (value: string) => value.split("-").reverse().join("-");

/** The quotation as an A4 PDF to print or send. */
export async function quotationPdf(actor: Actor, id: string): Promise<{ number: string; bytes: Uint8Array }> {
  const quotation = await getQuotation(actor, id);
  const { doc, pdf } = await pdfWriter(false);
  pdf.title(`${quotation.quotationType} ${quotation.number}`);
  pdf.pairs([
    ["Create Date", day(quotation.quotationDate)],
    ["Valid Till", day(quotation.validTill)],
    ["Customer", `${quotation.customerCode} - ${quotation.customerName}`],
    ["Mobile No.", quotation.contactMobile ?? "-"],
    ["Billing Address", quotation.billingAddress ?? "-"],
    ["Contact", [quotation.billingContactPerson, quotation.billingContactNo].filter(Boolean).join(", ") || "-"],
    ["Reference", quotation.reference ?? "-"],
    ["Office", quotation.officeName],
  ]);
  if (quotation.subject) pdf.heading(`Subject: ${quotation.subject}`);
  for (const line of richTextToPlain(quotation.remarksBody).split("\n").filter(Boolean)) pdf.text(line);

  pdf.heading("Items");
  pdf.table(
    [
      { header: "SL", width: 3, align: "right" },
      { header: "Item", width: 24 },
      { header: "Qty", width: 7, align: "right" },
      { header: "Unit Price", width: 8, align: "right" },
      { header: "Disc", width: 7, align: "right" },
      { header: "VAT %", width: 5, align: "right" },
      { header: "AIT %", width: 5, align: "right" },
      { header: "Amount", width: 9, align: "right" },
      { header: "Warranty", width: 7 },
      { header: "Delivery", width: 7 },
    ],
    quotation.lines.map((line, index) => [
      String(index + 1),
      `${line.itemCode} - ${line.itemName}`,
      `${line.qty.toLocaleString("en-US")} ${line.uom}`,
      money(line.rate),
      money(line.discountAmount),
      String(line.vatPercent),
      String(line.aitPercent),
      money(line.amount),
      line.warranty ?? "",
      line.deliveryDate ? day(line.deliveryDate) : "",
    ]),
    [
      ["", "Sub Total", "", "", "", "", "", money(quotation.subTotal), "", ""],
      ["", "Discount", "", "", "", "", "", money(quotation.discountAmount), "", ""],
      ["", quotation.includingVat ? "VAT (included)" : "VAT", "", "", "", "", "", money(quotation.vatAmount), "", ""],
      ["", "AIT", "", "", "", "", "", money(quotation.aitAmount), "", ""],
      ["", "Grand Total", "", "", "", "", "", money(quotation.grandTotal), "", ""],
    ],
  );
  for (const line of richTextToPlain(quotation.remarksFooter).split("\n").filter(Boolean)) pdf.text(line);
  if (quotation.termsList.length) {
    pdf.heading("Terms & Conditions");
    quotation.termsList.forEach((term, index) => pdf.text(`${index + 1}. ${term.text}${term.optional ? " (optional)" : ""}`));
  }
  await addPageFooters(doc, `${quotation.number} · ${STATUS_LABELS[quotation.status]}`);
  return { number: quotation.number, bytes: await doc.save() };
}

/** The filtered quotation list as .xlsx. */
export async function quotationsExcel(actor: Actor, raw: unknown): Promise<Uint8Array> {
  const query = quotationListQuerySchema.parse(raw);
  const rows = await listQuotations(actor, query);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sales Quotation");
  const columns: [string, number][] = [
    ["SL", 6],
    ["Status", 12],
    ["Quotation Code", 20],
    ["Office Name", 22],
    ["Customer Name", 30],
    ["Mobile No.", 16],
    ["Quotation Date", 14],
    ["Valid Till Date", 14],
    ["Amount", 16],
  ];
  const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
  sheet.addRow(columns.map(([label]) => label)).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = border;
  });
  rows.forEach((row, index) =>
    sheet
      .addRow([
        index + 1,
        STATUS_LABELS[displayStatus(row.status, row.validTill, query.today)],
        row.number,
        row.officeName,
        row.customerName,
        row.contactMobile ?? "",
        day(row.quotationDate),
        day(row.validTill),
        row.grandTotal,
      ])
      .eachCell({ includeEmpty: true }, (cell) => (cell.border = border)),
  );
  const total = sheet.addRow(["", "", "Total", "", "", "", "", "", Math.round(rows.reduce((sum, row) => sum + row.grandTotal, 0) * 100) / 100]);
  total.font = { bold: true };
  columns.forEach(([, width], index) => (sheet.getColumn(index + 1).width = width));
  sheet.getColumn(9).numFmt = "#,##0.00";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
