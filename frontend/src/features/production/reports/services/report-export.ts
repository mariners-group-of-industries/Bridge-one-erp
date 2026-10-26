import ExcelJS from "exceljs";
import type { Actor } from "@/lib/auth/actor";
import { addPageFooters, pdfWriter } from "../../lib/pdf";
import { cellText } from "../lib/format";
import type { ColumnKind, Report, ReportCell } from "../schemas/report.schema";
import { getReport } from "./report.service";

const FORMATS: Partial<Record<ColumnKind, string>> = { qty: "#,##0.00##", money: "#,##0.00", percent: "0.00\"%\"", hours: "#,##0.00" };

const fileName = (report: Report, extension: string) => `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`;

export async function reportExcel(actor: Actor, raw: unknown): Promise<{ name: string; bytes: Uint8Array }> {
  const report = await getReport(actor, raw);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(report.title.slice(0, 31));
  const width = report.columns.length;
  const banner = (text: string, size: number, bold: boolean) => {
    const row = sheet.addRow([text]);
    sheet.mergeCells(row.number, 1, row.number, Math.max(width, 1));
    row.getCell(1).font = { size, bold };
    row.getCell(1).alignment = { horizontal: "center" };
  };
  banner(report.company, 14, true);
  banner(report.title, 12, true);
  for (const line of report.subtitle) banner(line, 10, false);
  sheet.addRow([]);

  const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
  const header = sheet.addRow(["SL", ...report.columns.map((column) => column.label)]);
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = border;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  const write = (values: ReportCell[], bold: boolean) => {
    const row = sheet.addRow(values);
    row.eachCell({ includeEmpty: true }, (cell, index) => {
      cell.border = border;
      if (bold) cell.font = { bold: true };
      const column = report.columns[index - 2];
      if (column && FORMATS[column.kind] && typeof cell.value === "number") cell.numFmt = FORMATS[column.kind]!;
    });
  };
  report.rows.forEach((row, index) =>
    write([index + 1, ...report.columns.map((column) => (column.kind === "date" ? cellText("date", row[column.key]) : (row[column.key] ?? "")))], false),
  );
  if (report.totals) write(["", ...report.columns.map((column) => report.totals![column.key] ?? "")], true);
  if (report.rows.length === 0) sheet.addRow(["No Data Found"]);
  for (const note of report.notes) sheet.addRow([note]).getCell(1).font = { italic: true, size: 9 };

  sheet.getColumn(1).width = 6;
  report.columns.forEach((column, index) => {
    sheet.getColumn(index + 2).width = column.kind === "text" ? Math.min(Math.max(column.label.length + 4, 14), 40) : Math.max(column.label.length + 2, 12);
  });
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  return { name: fileName(report, "xlsx"), bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) };
}

export async function reportPdf(actor: Actor, raw: unknown): Promise<{ name: string; bytes: Uint8Array }> {
  const report = await getReport(actor, raw);
  const { doc, pdf } = await pdfWriter(true);
  pdf.title(report.company ? `${report.company} - ${report.title}` : report.title);
  for (const line of report.subtitle) pdf.text(line);
  if (report.rows.length === 0) {
    pdf.heading("No Data Found");
  } else {
    // Wide (day-by-day) reports get narrower columns; text columns take more room.
    const columns = [
      { header: "SL", width: 3, align: "right" as const },
      ...report.columns.map((column) => ({
        header: column.label,
        width: column.kind === "text" ? (report.columns.length > 14 ? 10 : 16) : report.columns.length > 14 ? 5 : 9,
        align: column.kind === "text" || column.kind === "date" ? ("left" as const) : ("right" as const),
      })),
    ];
    pdf.table(
      columns,
      report.rows.map((row, index) => [String(index + 1), ...report.columns.map((column) => cellText(column.kind, row[column.key]))]),
      report.totals ? [["", ...report.columns.map((column) => cellText(column.kind, report.totals![column.key] ?? null).replace(/^—$/, ""))]] : [],
    );
  }
  for (const note of report.notes) pdf.text(note);
  await addPageFooters(doc, `${report.company} · ${report.title} · printed ${new Date().toISOString().slice(0, 10).split("-").reverse().join("-")}`);
  return { name: fileName(report, "pdf"), bytes: await doc.save() };
}
