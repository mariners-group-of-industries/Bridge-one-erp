import { db } from "@/lib/prisma/client";
import { purchaseStore, type PurchaseActor } from "@/lib/purchase-store/store";
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
 * Purchase Return bulk upload. One row per returned line; rows with the same Ref
 * make one return. Against a goods receipt (GRN Number) quantities are checked
 * against what was received; "WITHOUT_REF" returns need Supplier, Office,
 * Warehouse and a Unit Price on every line.
 */

const COLUMNS = [
  { key: "ref", header: "Ref *", width: 12 },
  { key: "grnNumber", header: "GRN Number *", width: 18 },
  { key: "returnDate", header: "Return Date *", width: 15 },
  { key: "returnType", header: "Return Type", width: 18 },
  { key: "supplier", header: "Supplier (Without ref only)", width: 28 },
  { key: "office", header: "Office (Without ref only)", width: 22 },
  { key: "warehouse", header: "Warehouse (Without ref only)", width: 22 },
  { key: "remarks", header: "Remarks", width: 30 },
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "returnQuantity", header: "Return Qty *", width: 14 },
  { key: "reason", header: "Reason", width: 24 },
  { key: "unitPrice", header: "Unit Price (Without ref only)", width: 26 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  ref: ["ref", "reference", "doc ref", "document ref", "group", "return ref"],
  grnNumber: ["grn number", "grn no", "grn", "goods receipt", "goods receipt number", "receipt no", "receipt number"],
  returnDate: ["return date", "date"],
  returnType: ["return type", "type"],
  supplier: ["supplier", "supplier name", "vendor"],
  office: ["office", "office name", "branch"],
  warehouse: ["warehouse", "warehouse name", "store", "godown"],
  remarks: ["remarks", "notes", "comment"],
  itemCode: ["item code", "item", "code", "item no"],
  returnQuantity: ["return qty", "returned qty", "qty returned", "return quantity", "quantity"],
  reason: ["reason", "return reason", "defect reason"],
  unitPrice: ["unit price", "price", "rate"],
};

const RETURN_TYPES: Record<string, string> = {
  replacement: "REPLACEMENT",
  "refund credit": "REFUND_CREDIT",
  refund: "REFUND_CREDIT",
  credit: "REFUND_CREDIT",
  repair: "REPAIR",
};

export async function returnImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Purchase Returns", COLUMNS, [
    "One row per returned line. Columns marked * are required.",
    "Rows with the same Ref (any text you choose, e.g. 1, 2, RET-001) are saved as one purchase return.",
    "Against a GRN: put the GRN number in GRN Number (e.g. GRN-2026-0001). Quantities are checked against what was received; no need to fill price.",
    "Without a GRN: put WITHOUT_REF in GRN Number and also fill Supplier, Office, Warehouse and Unit Price on every line.",
    "Return Type: Replacement, Refund Credit or Repair (default Refund Credit).",
    "Supplier, Office and Warehouse must match existing names exactly (case does not matter).",
    "Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importPurchaseReturns(actor: PurchaseActor & { name?: string }, actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { groups } = await parseLineSheet(bytes, "Purchase Returns", COLUMNS, ALIASES, "itemCode", [
    "ref",
    "grnNumber",
    "returnDate",
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

      const returnDate = toIsoDate(consistent("returnDate"), "Return Date");
      const grnInput = consistent("grnNumber");
      const isWithoutRef = grnInput.trim().toUpperCase() === "WITHOUT_REF";
      const returnTypeRaw = consistent("returnType").trim().toLowerCase();
      const returnType = returnTypeRaw ? RETURN_TYPES[returnTypeRaw] : undefined;
      if (returnTypeRaw && !returnType) throw new Error("Return Type: use Replacement, Refund Credit or Repair.");

      if (!isWithoutRef) {
        const grn = await db().goodsReceipt.findFirst({
          where: isUuid(grnInput) ? { id: grnInput } : { number: grnInput },
          select: { number: true },
        });
        if (!grn) throw new Error(`Goods receipt "${grnInput}" not found.`);
      } else {
        supplierByName(lookups, consistent("supplier"));
        officeByName(lookups, consistent("office"));
        warehouseByName(lookups, consistent("warehouse"));
      }

      const items = group.rows.map(({ row, get }) => {
        try {
          const item = itemByCode(lookups, get("itemCode"));
          const returnQuantity = toNumber(get("returnQuantity"), "Return Qty", { required: true });
          if (returnQuantity <= 0) throw new Error("Return Qty must be greater than 0.");
          const base = {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            uom: item.uom,
            returnQuantity,
            eligibleReturnQuantity: returnQuantity,
            reason: get("reason").trim() || "Defective",
          };
          if (isWithoutRef) {
            const unitPrice = toNumber(get("unitPrice"), "Unit Price", { required: true });
            if (unitPrice < 0) throw new Error("Unit Price cannot be negative.");
            return { ...base, unitPrice };
          }
          // Against a GRN the store takes prices and quantities from the receipt lines.
          return { ...base, receivedQuantity: returnQuantity, previouslyReturnedQuantity: 0, unitPrice: 0, lineTotal: 0 };
        } catch (error) {
          throw new Error(`Line ${row}: ${describe(error)}`);
        }
      });

      const header: Record<string, unknown> = {
        goodsReceiptId: isWithoutRef ? "WITHOUT_REF" : grnInput,
        returnDate,
        returnType: returnType ?? "REFUND_CREDIT",
        ...(consistent("remarks") ? { remarks: consistent("remarks") } : {}),
      };
      if (isWithoutRef) {
        header.supplierId = supplierByName(lookups, consistent("supplier")).id;
        header.officeId = officeByName(lookups, consistent("office")).id;
        header.warehouseId = warehouseByName(lookups, consistent("warehouse")).id;
      }

      await purchaseStore.createPurchaseReturn({ ...header, items }, actorName, actor);
      result.created += 1;
    } catch (error) {
      result.errors.push({ row: group.firstRow, message: describe(error) });
    }
  }
  return result;
}
