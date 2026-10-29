import type { Actor } from "@/lib/auth/actor";
import { pdfWriter } from "@/lib/pdf";
import { getEntry } from "./entry.service";

const qty = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (value: string) => value.split("-").reverse().join("-");

/** Production entry slip as a printable PDF. */
export async function entryPdf(actor: Actor, id: string): Promise<{ number: string; bytes: Uint8Array }> {
  const entry = await getEntry(actor, id);
  const { doc, pdf } = await pdfWriter(true);
  pdf.title(`Production Entry ${entry.number}${entry.status === "CANCELLED" ? " (CANCELLED)" : ""}`);
  pdf.pairs([
    ["Entry Date", day(entry.entryDate)],
    ["Prod. Order No", entry.orderNumber],
    ["Sales Order", entry.salesOrderNumber ?? "N/A"],
    ["Office", entry.officeName],
    ["Department", entry.departmentName ?? "N/A"],
    ["Section", entry.sectionName ?? "N/A"],
    ["Work Center", entry.workCenterName ?? "N/A"],
    ["Shift", entry.shift ?? "N/A"],
    ["Item", `${entry.itemCode} - ${entry.itemName}`],
    ["Category", [entry.categoryName, entry.subCategoryName].filter(Boolean).join(" / ") || "N/A"],
    ["Material From", entry.sourceWarehouseName],
    ["Output To", entry.outputWarehouseName],
    ["Machine Hours", qty(entry.hours)],
    ["Created By", entry.createdByName],
  ]);

  pdf.heading("Output");
  pdf.table(
    [
      { header: "Total QTY", width: 12, align: "right" },
      { header: "Reject QTY", width: 12, align: "right" },
      { header: "Net QTY", width: 12, align: "right" },
      { header: "Excess QTY", width: 12, align: "right" },
      { header: "Net Weight", width: 12, align: "right" },
      { header: "Standard Cost", width: 14, align: "right" },
      { header: "Actual Cost", width: 14, align: "right" },
      { header: "Variance", width: 12, align: "right" },
    ],
    [
      [
        `${qty(entry.totalQty)} ${entry.uom}`,
        qty(entry.rejectQty),
        qty(entry.netQty),
        qty(entry.excessQty),
        qty(entry.netWeight),
        money(entry.standardCost),
        money(entry.actualCost),
        money(entry.variance),
      ],
    ],
  );

  pdf.heading("Material Consumption");
  pdf.table(
    [
      { header: "SL", width: 4, align: "right" },
      { header: "Item Code", width: 12 },
      { header: "Item Name", width: 30 },
      { header: "UoM", width: 6 },
      { header: "Standard QTY", width: 10, align: "right" },
      { header: "Actual QTY", width: 10, align: "right" },
      { header: "Wastage", width: 9, align: "right" },
      { header: "Scrap", width: 9, align: "right" },
      { header: "Variance QTY", width: 10, align: "right" },
    ],
    entry.materials.map((line, index) => [
      String(index + 1),
      line.code,
      line.name,
      line.uom,
      qty(line.standardQty),
      qty(line.actualQty),
      qty(line.wastageQty),
      qty(line.scrapQty),
      qty(line.varianceQty),
    ]),
  );
  if (entry.remarks) pdf.heading(`Remarks: ${entry.remarks}`);
  if (entry.cancelReason) pdf.heading(`Cancelled by ${entry.cancelledByName ?? ""}: ${entry.cancelReason}`);
  return { number: entry.number, bytes: await doc.save() };
}
