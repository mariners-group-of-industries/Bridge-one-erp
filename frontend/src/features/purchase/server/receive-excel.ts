import { db } from "@/lib/prisma/client";
import { purchaseStore, type PurchaseActor } from "@/lib/purchase-store/store";
import { effectiveUnitCost, round2, round3 } from "@/lib/purchase-store/rules";
import {
  buildTemplate,
  parseLineSheet,
  toIsoDate,
  toNumber,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { isUuid } from "@/lib/accounting/ids";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { loadPurchaseLookups, officeByName, warehouseByName, supplierByName, itemByCode } from "./purchase-lookups";

/**
 * Goods Receipt bulk upload. One row per received line; rows with the same Ref
 * make one GRN. Against a purchase order (PO Number) the lines are matched to
 * the order by item; "DIRECT" receives against no order and also needs Supplier,
 * Office, Warehouse and a Unit Price on every line.
 */

const COLUMNS = [
  { key: "ref", header: "Ref *", width: 12 },
  { key: "poNumber", header: "PO Number *", width: 18 },
  { key: "receiptDate", header: "Receipt Date *", width: 15 },
  { key: "supplier", header: "Supplier (Direct only)", width: 28 },
  { key: "office", header: "Office (Direct only)", width: 20 },
  { key: "warehouse", header: "Warehouse (Direct only)", width: 20 },
  { key: "challanNumber", header: "Challan Number", width: 18 },
  { key: "gatePassNumber", header: "Gate Pass Number", width: 18 },
  { key: "vatChallanNumber", header: "VAT Challan Number", width: 20 },
  { key: "supplierInvoiceNumber", header: "Supplier Invoice Number", width: 22 },
  { key: "shipmentNumber", header: "Shipment Number", width: 18 },
  { key: "remarks", header: "Remarks", width: 30 },
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "receivedQuantity", header: "Received Qty *", width: 15 },
  { key: "rejectedQuantity", header: "Rejected Qty", width: 14 },
  { key: "unitPrice", header: "Unit Price (Direct only)", width: 22 },
  { key: "lineRemarks", header: "Line Remarks", width: 30 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  ref: ["ref", "reference", "doc ref", "document ref", "group", "grn ref"],
  poNumber: ["po number", "po no", "purchase order", "purchase order number", "order no", "order number", "po"],
  receiptDate: ["receipt date", "grn date", "receive date", "received date", "date"],
  supplier: ["supplier", "supplier name", "vendor"],
  office: ["office", "office name", "branch"],
  warehouse: ["warehouse", "warehouse name", "store", "godown"],
  challanNumber: ["challan number", "challan no", "challan"],
  gatePassNumber: ["gate pass number", "gate pass", "delivery note number", "delivery note"],
  vatChallanNumber: ["vat challan number", "vat challan"],
  supplierInvoiceNumber: ["supplier invoice number", "invoice number", "invoice no", "supplier invoice"],
  shipmentNumber: ["shipment number", "shipment no", "shipment"],
  remarks: ["remarks", "notes", "comment"],
  itemCode: ["item code", "item", "code", "item no"],
  receivedQuantity: ["received qty", "receive qty", "qty received", "received quantity", "current received qty", "quantity"],
  rejectedQuantity: ["rejected qty", "rejected quantity", "damaged qty", "rejected"],
  unitPrice: ["unit price", "price", "rate"],
  lineRemarks: ["line remarks", "line notes"],
};

export async function receiveImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Goods Receipts", COLUMNS, [
    "One row per received line. Columns marked * are required.",
    "Rows with the same Ref (any text you choose, e.g. 1, 2, GRN-001) are saved as one goods receipt.",
    "Against a purchase order: put the PO number in PO Number (e.g. PO-2026-0001). Lines are matched to the order by item; receipt cannot exceed the outstanding quantity.",
    "Direct (no purchase order): put DIRECT in PO Number and also fill Supplier, Office, Warehouse and Unit Price on every line.",
    "Supplier, Office and Warehouse must match existing names exactly (case does not matter).",
    "Received Qty and Rejected Qty are numbers. Unit Price only applies to DIRECT receives; against a PO the order's price is used.",
    "Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importGoodsReceipts(actor: PurchaseActor & { name?: string }, actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { groups } = await parseLineSheet(bytes, "Goods Receipts", COLUMNS, ALIASES, "itemCode", [
    "ref",
    "poNumber",
    "receiptDate",
    "itemCode",
  ]);
  const lookups = await loadPurchaseLookups(actor);
  const result: ImportResult = { created: 0, errors: [] };

  for (const group of groups) {
    try {
      const consistent = <K extends ColumnKey>(key: K): string => {
        const values = group.rows.map((r) => r.get(key).trim()).filter(Boolean);
        const first = values[0] ?? "";
        const clash = values.find((v) => v.toLowerCase() !== first.toLowerCase());
        if (clash !== undefined) {
          const badRow = group.rows.find((r) => r.get(key).trim().toLowerCase() === clash.toLowerCase())!.row;
          throw new Error(`Row ${badRow}: ${COLUMNS.find((c) => c.key === key)!.header.replace(" *", "")} "${clash}" does not match the first row of Ref "${group.ref}".`);
        }
        return first;
      };

      const receiptDate = toIsoDate(consistent("receiptDate"), "Receipt Date");
      const poInput = consistent("poNumber");
      const isDirect = poInput.trim().toUpperCase() === "DIRECT";

      // Resolve the order (PO mode) once per Receipt.
      let order: {
        id: string;
        number: string;
        warehouseId: string | null;
        officeId: string;
        supplierId: string;
        lines: { id: string; itemId: string | null; itemCode: string; itemName: string; uom: string; quantity: unknown; receivedQuantity: unknown; lineTotal: unknown }[];
      } | null = null;
      if (!isDirect) {
        const found = await db().purchaseOrder.findFirst({
          where: isUuid(poInput) ? { id: poInput } : { number: poInput },
          select: {
            id: true,
            number: true,
            warehouseId: true,
            officeId: true,
            supplierId: true,
            lines: { select: { id: true, itemId: true, itemCode: true, itemName: true, uom: true, quantity: true, receivedQuantity: true, lineTotal: true }, orderBy: { lineNo: "asc" } },
          },
        });
        if (!found) throw new Error(`Purchase order "${poInput}" not found.`);
        order = found;
      } else {
        // Direct receives need the routing columns.
        supplierByName(lookups, consistent("supplier"));
        const office = officeByName(lookups, consistent("office"));
        warehouseByName(lookups, consistent("warehouse"));
        void office;
      }

      let matchedOrderLines = new Map<string, string>(); // itemId → order line id (per line, consumed once)
      if (order) {
        matchedOrderLines = new Map(order.lines.filter((l) => l.itemId).map((l) => [l.itemId as string, l.id]));
      }

      const items = group.rows.map(({ row, get }) => {
        try {
          const item = itemByCode(lookups, get("itemCode"));
          const received = toNumber(get("receivedQuantity"), "Received Qty", { required: true });
          if (received <= 0) throw new Error("Received Qty must be greater than 0.");
          const rejected = toNumber(get("rejectedQuantity"), "Rejected Qty");
          if (rejected < 0) throw new Error("Rejected Qty cannot be negative.");
          if (rejected > received) throw new Error("Rejected Qty cannot be more than Received Qty.");

          if (order) {
            const line = order.lines.find((l) => l.id === matchedOrderLines.get(item.id) || l.itemId === item.id);
            if (!line) throw new Error(`Item code "${item.code}" is not on order ${order.number}.`);
            matchedOrderLines.delete(item.id);
            const orderedQuantity = Number(line.quantity);
            return {
              poItemId: line.id,
              itemId: line.itemId,
              itemCode: line.itemCode,
              itemName: line.itemName,
              uom: line.uom,
              orderedQuantity,
              previouslyReceivedQuantity: Number(line.receivedQuantity),
              currentReceivedQuantity: received,
              rejectedDamagedQuantity: rejected,
              unitPrice: effectiveUnitCost(Number(line.lineTotal), orderedQuantity),
              lineTotal: round2((received - rejected) * effectiveUnitCost(Number(line.lineTotal), orderedQuantity)),
              ...(get("lineRemarks") ? { remarks: get("lineRemarks") } : {}),
            };
          }
          const unitPrice = toNumber(get("unitPrice"), "Unit Price", { required: true });
          if (unitPrice < 0) throw new Error("Unit Price cannot be negative.");
          return {
            poItemId: "",
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            uom: item.uom,
            orderedQuantity: round3(received),
            previouslyReceivedQuantity: 0,
            currentReceivedQuantity: received,
            rejectedDamagedQuantity: rejected,
            unitPrice,
            lineTotal: round2((received - rejected) * unitPrice),
            ...(get("lineRemarks") ? { remarks: get("lineRemarks") } : {}),
          };
        } catch (error) {
          throw new Error(`Line ${row}: ${describe(error)}`);
        }
      });

      const header: Record<string, unknown> = {
        purchaseOrderId: isDirect ? "DIRECT" : order!.id,
        receiptDate,
        ...(consistent("challanNumber") ? { challanNumber: consistent("challanNumber"), shipmentDocumentNumber: consistent("challanNumber") } : {}),
        ...(consistent("gatePassNumber") ? { gatePassNumber: consistent("gatePassNumber") } : {}),
        ...(consistent("vatChallanNumber") ? { vatChallanNumber: consistent("vatChallanNumber") } : {}),
        ...(consistent("supplierInvoiceNumber") ? { supplierInvoiceNumber: consistent("supplierInvoiceNumber") } : {}),
        ...(consistent("shipmentNumber") ? { shipmentNumber: consistent("shipmentNumber") } : {}),
        ...(consistent("remarks") ? { remarks: consistent("remarks") } : {}),
      };
      if (isDirect) {
        header.supplierId = supplierByName(lookups, consistent("supplier")).id;
        header.officeId = officeByName(lookups, consistent("office")).id;
        header.warehouseId = warehouseByName(lookups, consistent("warehouse")).id;
      }

      await purchaseStore.createGoodsReceipt({ ...header, items }, actorName, actor);
      result.created += 1;
    } catch (error) {
      result.errors.push({ row: group.firstRow, message: describe(error) });
    }
  }
  return result;
}
