import ExcelJS from "exceljs";
import { z } from "zod";
import { addPageFooters, pdfWriter } from "@/lib/pdf";

/** A screen table to export as it is shown (Sales Collection's Excel / PDF buttons). */
export const tableExportSchema = z.object({
  format: z.enum(["xlsx", "pdf"]),
  title: z.string().trim().min(1).max(120),
  headers: z.array(z.string().max(80)).min(1).max(40),
  rows: z.array(z.array(z.union([z.string().max(500), z.number(), z.null()]))).max(10_000),
});
export type TableExport = z.infer<typeof tableExportSchema>;

const fileName = (title: string, extension: string) => `${title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "export"}.${extension}`;

export async function tableExport(raw: unknown): Promise<{ bytes: Uint8Array; contentType: string; fileName: string }> {
  const { format, title, headers, rows } = tableExportSchema.parse(raw);
  if (format === "xlsx") {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet(title.slice(0, 31));
    const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
    sheet.addRow(headers).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      cell.border = border;
    });
    for (const row of rows) sheet.addRow(row.map((cell) => cell ?? "")).eachCell({ includeEmpty: true }, (cell) => (cell.border = border));
    headers.forEach((header, index) => {
      const longest = Math.max(header.length, ...rows.slice(0, 200).map((row) => String(row[index] ?? "").length));
      sheet.getColumn(index + 1).width = Math.min(45, Math.max(8, longest + 2));
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    return {
      bytes: new Uint8Array(await book.xlsx.writeBuffer()),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: fileName(title, "xlsx"),
    };
  }
  const { doc, pdf } = await pdfWriter(headers.length > 6);
  pdf.title(title);
  const widths = headers.map((header, index) => Math.min(30, Math.max(5, header.length, ...rows.slice(0, 100).map((row) => String(row[index] ?? "").length))));
  pdf.table(
    headers.map((header, index) => ({ header, width: widths[index], align: rows.some((row) => typeof row[index] === "number") ? "right" : "left" })),
    rows.map((row) => row.map((cell) => (typeof cell === "number" ? cell.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (cell ?? "")))),
  );
  await addPageFooters(doc, title);
  return { bytes: await doc.save(), contentType: "application/pdf", fileName: fileName(title, "pdf") };
}
