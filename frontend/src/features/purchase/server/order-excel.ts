import { purchaseStore, type PurchaseActor } from "@/lib/purchase-store/store";
import { priceLine, round2 } from "@/lib/purchase-store/rules";
import {
  buildTemplate,
  parseLineSheet,
  toIsoDate,
  toNumber,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { loadPurchaseLookups, officeByName, warehouseByName, supplierByName, itemByCode } from "./purchase-lookups";

/**
 * Purchase Order bulk upload. One row per line item; rows with the same Ref make
 * one purchase order. Supplier/items are matched by name/code.
 */

const COLUMNS = [
  { key: "ref", header: "Ref *", width: 12 },
  { key: "orderDate", header: "Order Date *", width: 15 },
  { key: "expectedDeliveryDate", header: "Expected Delivery Date *", width: 22 },
  { key: "supplier", header: "Supplier *", width: 30 },
  { key: "office", header: "Office *", width: 22 },
  { key: "warehouse", header: "Warehouse *", width: 20 },
  { key: "referenceNumber", header: "Reference Number", width: 20 },
  { key: "projectCostCenter", header: "Project / Cost Center", width: 22 },
  { key: "paymentTerms", header: "Payment Terms", width: 20 },
  { key: "deliveryTerms", header: "Delivery Terms", width: 20 },
  { key: "shippingFee", header: "Shipping Fee", width: 14 },
  { key: "notes", header: "Notes", width: 30 },
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "orderedQuantity", header: "Quantity *", width: 12 },
  { key: "unitPrice", header: "Unit Price *", width: 14 },
  { key: "discountPercentage", header: "Discount %", width: 12 },
  { key: "taxPercentage", header: "VAT %", width: 10 },
  { key: "lineRemarks", header: "Line Remarks", width: 30 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  ref: ["ref", "reference", "doc ref", "document ref", "group", "doc key", "po no", "po number"],
  orderDate: ["order date", "date", "po date", "purchase order date"],
  expectedDeliveryDate: ["expected delivery date", "expected date", "delivery date", "eta", "expected on"],
  supplier: ["supplier", "supplier name", "vendor", "vendor name", "partner"],
  office: ["office", "office name", "branch"],
  warehouse: ["warehouse", "warehouse name", "store", "godown"],
  referenceNumber: ["reference number", "reference no", "reference", "buyer reference", "your ref"],
  projectCostCenter: ["project / cost center", "project", "cost center", "project name", "cost centre"],
  paymentTerms: ["payment terms", "terms of payment"],
  deliveryTerms: ["delivery terms", "terms of delivery", "incoterms"],
  shippingFee: ["shipping fee", "shipping", "freight", "transport"],
  notes: ["notes", "remarks", "comment"],
  itemCode: ["item code", "item", "code", "item no", "item number"],
  orderedQuantity: ["quantity", "qty", "ordered qty", "order qty", "po qty"],
  unitPrice: ["unit price", "price", "rate", "cost", "unit cost"],
  discountPercentage: ["discount %", "discount percent", "discount", "disc %"],
  taxPercentage: ["vat %", "vat", "tax %", "tax percent", "tax"],
  lineRemarks: ["line remarks", "line notes"],
};

export async function orderImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Purchase Orders", COLUMNS, [
    "One row per item line. Columns marked * are required.",
    "Rows with the same Ref (any text you choose, e.g. 1, 2, PO-001) are saved as one purchase order.",
    "Header columns (everything before Item Code) only need values on the first row of each Ref; every row of a Ref must agree on them.",
    "Supplier, Office and Warehouse must match existing names exactly (case does not matter). The warehouse must belong to the office.",
    "Item Code: existing active items (Configuration › Item Profile). Quantity, Unit Price, Discount %, VAT % and Shipping Fee are numbers.",
    "Line totals are calculated (gross − discount + VAT). Payment/Delivery Terms default to Net 30 / FOB Destination when empty.",
    "Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importPurchaseOrders(actor: PurchaseActor & { name?: string }, actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { groups } = await parseLineSheet(bytes, "Purchase Orders", COLUMNS, ALIASES, "itemCode", [
    "ref",
    "orderDate",
    "expectedDeliveryDate",
    "supplier",
    "office",
    "warehouse",
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

      const office = officeByName(lookups, consistent("office"));
      const warehouse = warehouseByName(lookups, consistent("warehouse"), office.id);
      const supplier = supplierByName(lookups, consistent("supplier"));
      const orderDate = toIsoDate(consistent("orderDate"), "Order Date");
      const expectedDeliveryDate = toIsoDate(consistent("expectedDeliveryDate"), "Expected Delivery Date");
      const shippingFee = toNumber(consistent("shippingFee"), "Shipping Fee");

      const items = group.rows.map(({ row, get }) => {
        try {
          const item = itemByCode(lookups, get("itemCode"));
          const orderedQuantity = toNumber(get("orderedQuantity"), "Quantity", { required: true });
          if (orderedQuantity <= 0) throw new Error("Quantity must be greater than 0.");
          const unitPrice = toNumber(get("unitPrice"), "Unit Price", { required: true });
          if (unitPrice < 0) throw new Error("Unit Price cannot be negative.");
          const discountPercentage = toNumber(get("discountPercentage"), "Discount %");
          const taxPercentage = toNumber(get("taxPercentage"), "VAT %");
          const priced = priceLine(orderedQuantity, unitPrice, discountPercentage, taxPercentage);
          return {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            uom: item.uom,
            orderedQuantity,
            receivedQuantity: 0,
            returnedQuantity: 0,
            outstandingQuantity: orderedQuantity,
            unitPrice,
            discountPercentage,
            discountAmount: priced.discount,
            taxPercentage,
            taxAmount: priced.tax,
            lineTotal: round2(priced.lineTotal),
            ...(get("lineRemarks") ? { remarks: get("lineRemarks") } : {}),
          };
        } catch (error) {
          throw new Error(`Line ${row}: ${describe(error)}`);
        }
      });

      await purchaseStore.createPurchaseOrder(
        {
          companyId: "comp-bridgeone-01",
          supplierId: supplier.id,
          officeId: office.id,
          warehouseId: warehouse.id,
          orderDate,
          expectedDeliveryDate,
          ...(consistent("referenceNumber") ? { referenceNumber: consistent("referenceNumber") } : {}),
          ...(consistent("projectCostCenter") ? { projectCostCenter: consistent("projectCostCenter") } : {}),
          paymentTerms: consistent("paymentTerms") || "Net 30 Days",
          deliveryTerms: consistent("deliveryTerms") || "FOB Destination",
          shippingFee,
          ...(consistent("notes") ? { notes: consistent("notes") } : {}),
          items,
        },
        actorName,
        actor,
      );
      result.created += 1;
    } catch (error) {
      result.errors.push({ row: group.firstRow, message: describe(error) });
    }
  }
  return result;
}
