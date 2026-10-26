import type { Actor } from "@/lib/auth/actor";
import { pdfWriter } from "../../lib/pdf";
import { APPROVAL_ORDER_LABELS, APPROVAL_STATUS_LABELS, ORDER_STATUS_LABELS } from "../schemas/order.schema";
import { getOrder } from "./order.service";

const qty = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (value: string) => value.split("-").reverse().join("-");
/** DD-MM-YYYY hh:mm:ss AM in Bangladesh time. */
const stamp = (iso: string) => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  return `${day(date.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }))} ${time}`;
};

/** "Production Order View" as a printable PDF. */
export async function orderPdf(actor: Actor, id: string): Promise<{ number: string; bytes: Uint8Array }> {
  const order = await getOrder(actor, id);
  const { doc, pdf } = await pdfWriter(true);
  pdf.title(`Production Order ${order.number}`);
  pdf.pairs([
    ["Product Order Code", order.number],
    ["Production Date", day(order.productionDate)],
    ["Order Date", day(order.orderDate)],
    ["Narration", order.narration ?? "-"],
    ["Office Name", order.officeName],
    ["Customer PoNo", order.customerPoNo ?? "-"],
    ["Work Center", order.workCenterName ?? "N/A"],
    ["Lot Size", qty(order.bomLotSize)],
    ["Warehouse", order.warehouseName],
    ["Status", ORDER_STATUS_LABELS[order.status]],
    ["Customer", order.customerName ?? "-"],
    ["Sales Order", order.salesOrderNumber ?? "-"],
  ]);

  pdf.heading("Finished goods details");
  pdf.table(
    [
      { header: "SL", width: 4, align: "right" },
      { header: "BOM Name", width: 26 },
      { header: "Item Code", width: 14 },
      { header: "Item Name", width: 36 },
      { header: "QTY", width: 12, align: "right" },
      { header: "Produced", width: 12, align: "right" },
    ],
    [["1", order.bomName, order.itemCode, order.itemName, `${qty(order.orderQty)} ${order.uom}`, `${qty(order.producedQty)} ${order.uom}`]],
  );

  pdf.heading("Material Details");
  pdf.table(
    [
      { header: "SL", width: 4, align: "right" },
      { header: "Item Code", width: 12 },
      { header: "Item Name", width: 30 },
      { header: "UoM", width: 6 },
      { header: "Required QTY", width: 10, align: "right" },
      { header: "Issue QTY", width: 9, align: "right" },
      { header: "Used QTY", width: 9, align: "right" },
      { header: "Remaining QTY", width: 10, align: "right" },
      { header: "Return QTY", width: 9, align: "right" },
    ],
    order.materials.map((line, index) => [
      String(index + 1),
      line.code,
      line.name,
      line.uom,
      qty(line.requiredQty),
      qty(line.issueQty),
      qty(line.usedQty),
      qty(line.remainingQty),
      qty(line.returnQty),
    ]),
  );

  pdf.heading("Approval Status");
  pdf.table(
    [
      { header: "SL", width: 4, align: "right" },
      { header: "Stage Name", width: 22 },
      { header: "Approver Name", width: 26 },
      { header: "Order Type", width: 10 },
      { header: "Status", width: 9 },
      { header: "Comment", width: 18 },
      { header: "Time", width: 16 },
    ],
    order.approvals.map((stage, index) => [
      String(index + 1),
      stage.stageName,
      (stage.approvedNames.length ? stage.approvedNames : stage.actedByName ? [stage.actedByName] : stage.approverNames).join(", ") || "Any approver",
      APPROVAL_ORDER_LABELS[stage.approvalOrder] ?? stage.approvalOrder,
      APPROVAL_STATUS_LABELS[stage.status],
      stage.comment ?? "N/A",
      stage.actedAt ? stamp(stage.actedAt) : "-",
    ]),
  );
  pdf.heading(`Produced value: ${money(order.producedValue)}   |   Created by: ${order.createdByName}`);
  return { number: order.number, bytes: await doc.save() };
}
