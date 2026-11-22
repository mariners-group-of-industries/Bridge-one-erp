import { db } from "@/lib/prisma/client";
import {
  buildTemplate,
  parseLineSheet,
  toIsoDate,
  toNumber,
  byName,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import type { Actor } from "@/lib/auth/actor";
import { INVENTORY_DOC_TYPES, type InventoryDocSlug } from "../schemas/document.schema";
import { createDocument } from "./inventory.service";

/**
 * Generic inventory document bulk upload, used by all seven inventory pages.
 * One row per line; rows with the same Ref make one document. Item codes and
 * warehouse names are matched case-insensitively.
 */

type ColumnKey =
  | "ref" | "docDate" | "expectedDate" | "warehouse" | "toWarehouse" | "partyName" | "subtype" | "reference"
  | "requestNumber" | "remarks" | "itemCode" | "qty" | "toItemCode" | "toQty" | "lineRemarks"
  | "refType" | "fromAddress" | "toAddress" | "vehicleNo" | "vehicleType" | "vehicleSize"
  | "driverName" | "driverPhone" | "weightBefore" | "weightAfter" | "directTransferIn";

const ALL_COLUMNS: readonly DocColumn<ColumnKey>[] = [
  { key: "ref", header: "Ref *", width: 12 },
  { key: "docDate", header: "Doc Date *", width: 15 },
  { key: "expectedDate", header: "Expected Date", width: 15 },
  { key: "warehouse", header: "Warehouse *", width: 22 },
  { key: "toWarehouse", header: "To Warehouse *", width: 22 },
  { key: "partyName", header: "Party / For", width: 24 },
  { key: "subtype", header: "Type", width: 18 },
  { key: "reference", header: "Reference", width: 20 },
  { key: "requestNumber", header: "Request Number", width: 17 },
  { key: "remarks", header: "Remarks", width: 30 },
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "qty", header: "Qty *", width: 11 },
  { key: "toItemCode", header: "To Item Code *", width: 17 },
  { key: "toQty", header: "To Qty *", width: 12 },
  { key: "lineRemarks", header: "Line Remarks", width: 28 },
  { key: "directTransferIn", header: "Direct Transfer In (Yes/No)", width: 24 },
  { key: "refType", header: "Reference Type", width: 19 },
  { key: "fromAddress", header: "From Address", width: 28 },
  { key: "toAddress", header: "To Address", width: 28 },
  { key: "vehicleNo", header: "Vehicle No", width: 17 },
  { key: "vehicleType", header: "Vehicle Type", width: 16 },
  { key: "vehicleSize", header: "Vehicle Size", width: 15 },
  { key: "driverName", header: "Driver Name", width: 20 },
  { key: "driverPhone", header: "Driver Mobile No", width: 18 },
  { key: "weightBefore", header: "Weight Before", width: 15 },
  { key: "weightAfter", header: "Weight After", width: 15 },
];

const COLUMN_SETS: Record<InventoryDocSlug, ColumnKey[]> = {
  "stock-adjustment": ["ref", "docDate", "warehouse", "subtype", "reference", "remarks", "itemCode", "qty", "lineRemarks"],
  "transfer-request": ["ref", "docDate", "expectedDate", "toWarehouse", "partyName", "reference", "remarks", "itemCode", "qty", "lineRemarks"],
  transfer: ["ref", "docDate", "expectedDate", "warehouse", "toWarehouse", "directTransferIn", "reference", "requestNumber", "remarks", "itemCode", "qty", "lineRemarks"],
  "store-requisition": ["ref", "docDate", "warehouse", "partyName", "subtype", "reference", "remarks", "itemCode", "qty", "lineRemarks"],
  "store-issue": ["ref", "docDate", "warehouse", "partyName", "subtype", "requestNumber", "reference", "remarks", "itemCode", "qty", "lineRemarks"],
  "item-stock-conversion": ["ref", "docDate", "warehouse", "subtype", "reference", "remarks", "itemCode", "qty", "toItemCode", "toQty", "lineRemarks"],
  "gate-in-out": [
    "ref", "docDate", "subtype", "partyName", "reference", "remarks",
    "refType", "fromAddress", "toAddress", "vehicleNo", "vehicleType", "vehicleSize",
    "driverName", "driverPhone", "weightBefore", "weightAfter",
    "itemCode", "qty", "lineRemarks",
  ],
};

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  ref: ["ref", "reference", "doc ref", "document ref", "group"],
  docDate: ["doc date", "date", "document date", "entry date"],
  expectedDate: ["expected date", "expected on", "expected delivery"],
  warehouse: ["warehouse", "warehouse name", "from warehouse", "store", "godown"],
  toWarehouse: ["to warehouse", "to store", "requesting warehouse", "destination warehouse"],
  partyName: ["party / for", "party", "party name", "for", "requisition for", "visitor name", "issued to", "requested for"],
  subtype: ["type", "subtype", "gate type", "user type", "conversion type"],
  reference: ["reference", "reference no", "reference number", "ref no"],
  requestNumber: ["request number", "request no", "against request", "requisition no"],
  remarks: ["remarks", "notes", "comment"],
  itemCode: ["item code", "item", "code", "item no"],
  qty: ["qty", "quantity", "issued qty", "req qty"],
  toItemCode: ["to item code", "target item", "new item"],
  toQty: ["to qty", "target qty", "new qty", "output qty"],
  lineRemarks: ["line remarks", "line notes"],
  refType: ["reference type", "ref type"],
  fromAddress: ["from address", "from"],
  toAddress: ["to address", "to"],
  vehicleNo: ["vehicle no", "vehicle number", "vehicle"],
  vehicleType: ["vehicle type"],
  vehicleSize: ["vehicle size"],
  driverName: ["driver name", "driver"],
  driverPhone: ["driver mobile no", "driver phone", "driver mobile", "driver contact"],
  weightBefore: ["weight before", "weight of scale (before)", "before weight"],
  weightAfter: ["weight after", "weight of scale (after)", "after weight"],
  directTransferIn: ["direct transfer in (yes/no)", "direct transfer in", "direct transfer"],
};

const TYPE_LABELS: Record<InventoryDocSlug, string> = {
  "stock-adjustment": "Stock Update",
  "transfer-request": "Transfer Request",
  transfer: "Transfer",
  "store-requisition": "Store Requisition",
  "store-issue": "Store Issue",
  "item-stock-conversion": "Item Conversion",
  "gate-in-out": "Gate In Out",
};

const SUBTYPE_HINTS: Partial<Record<InventoryDocSlug, string>> = {
  "stock-adjustment": "Type: Stock Audit, Stock Adjustment or Damage (default Stock Adjustment).",
  "store-issue": "Type: Employee, Department or Project (who the issue is for).",
  "store-requisition": "Type: Employee, Department or Project (who the requisition is for).",
  "item-stock-conversion": "Type: Stock Transfer, Bundle, Un-Bundle or ONE TO ONE.",
  "gate-in-out": "Type: Gate In, Gate Out or Visitor. Visitor passes need the party name and cannot carry items.",
};

export function inventoryColumns(slug: InventoryDocSlug): DocColumn<ColumnKey>[] {
  const keys = COLUMN_SETS[slug];
  const header = (key: ColumnKey) => {
    if (slug === "transfer" && key === "warehouse") return "From Warehouse *";
    if (slug === "transfer-request" && key === "toWarehouse") return "Requesting Warehouse *";
    return ALL_COLUMNS.find((c) => c.key === key)!.header;
  };
  return ALL_COLUMNS.filter((c) => keys.includes(c.key)).map((c) => ({ ...c, header: header(c.key) }));
}

export async function inventoryImportTemplate(slug: InventoryDocSlug): Promise<Uint8Array> {
  const columns = inventoryColumns(slug);
  const label = TYPE_LABELS[slug];
  const lines = [
    `${label} bulk upload — one row per item line. Columns marked * are required.`,
    "Rows with the same Ref (any text you choose, e.g. 1, 2, DOC-001) are saved as one document.",
    "Header columns (everything before Item Code) only need values on the first row of each Ref; every row of a Ref must agree on them.",
    "Warehouse names must match existing warehouses exactly (case does not matter).",
    "Item Code: existing active items (Configuration › Item Profile); the receiving warehouse must be in your access.",
    "Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
    ...(SUBTYPE_HINTS[slug] ? [SUBTYPE_HINTS[slug]!] : []),
  ];
  if (slug === "stock-adjustment") {
    lines.push("Qty: positive adds stock, negative removes it (e.g. -5 for a damage write-off). Stock Updates wait for approval.");
    lines.push("Approve posts the update to the stock ledger (Accounts › Inventory).");
  } else if (slug === "transfer") {
    lines.push("Request Number is optional: use an approved Transfer Request number to fulfil it.");
    lines.push("Direct Transfer In = Yes receives the goods at once (no in-transit step). Transfers otherwise ship IN_TRANSIT for receipt.");
  } else if (slug === "store-issue") {
    lines.push("Request Number is optional: use an approved Store Requisition number to fulfil it.");
  } else if (slug === "store-requisition") {
    lines.push("Party / For: the employee, department or project the store is for. Store Requisitions wait for approval.");
  } else if (slug === "item-stock-conversion") {
    lines.push("Item Code = the source item; To Item Code = the target item (different item). Qty = consumed, To Qty = produced. Waits for approval.");
  } else if (slug === "transfer-request") {
    lines.push("Requesting Warehouse: the warehouse asking for the stock. Transfer Requests wait for approval.");
  } else if (slug === "gate-in-out") {
    lines.push("One Ref per gate pass. Visitor passes: put the visitor's name in Party / For; vehicle details are for goods passes.");
  }
  return buildTemplate(label, columns, lines);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

const yesNo = (raw: string) => ["yes", "y", "true", "1"].includes(raw.trim().toLowerCase());

export async function importInventoryDocuments(
  slug: InventoryDocSlug,
  actor: Actor,
  _actorName: string,
  bytes: Uint8Array,
): Promise<ImportResult> {
  const columns = inventoryColumns(slug);
  const required: ColumnKey[] = ["ref", "docDate", "itemCode"];
  if (slug === "stock-adjustment" || slug === "store-requisition" || slug === "store-issue" || slug === "item-stock-conversion") required.push("warehouse");
  if (slug === "transfer" || slug === "transfer-request") required.push("toWarehouse");
  if (slug === "transfer") required.push("warehouse");
  if (slug === "store-requisition") required.push("partyName");
  if (slug === "item-stock-conversion") required.push("toItemCode", "toQty");
  if (slug === "gate-in-out") required.push("subtype");

  const { groups } = await parseLineSheet(bytes, TYPE_LABELS[slug], columns, ALIASES, "itemCode", required);

  const prisma = db();
  const [warehouses, items] = await Promise.all([
    prisma.warehouse.findMany({ select: { id: true, name: true, officeId: true, office: { select: { name: true, businessUnitId: true } } } }),
    prisma.item.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, uom: true, businessUnitId: true } }),
  ]);
  const warehouseByName = (raw: string) => {
    const value = raw.trim();
    if (!value) return undefined;
    const found = warehouses.find((w) => w.name.trim().toLowerCase() === value.toLowerCase());
    if (!found) throw new Error(`Warehouse "${value}" not found.`);
    return found;
  };
  const itemByCode = (raw: string) => {
    const value = raw.trim();
    const found = items.find((i) => i.code.trim().toLowerCase() === value.toLowerCase());
    if (!found) throw new Error(`Item code "${value}" not found.`);
    return found;
  };

  const result: ImportResult = { created: 0, errors: [] };

  for (const group of groups) {
    try {
      const consistent = <K extends ColumnKey>(key: K): string => {
        const values = group.rows.map((r) => r.get(key).trim()).filter(Boolean);
        const first = values[0] ?? "";
        const clash = values.find((v) => v.toLowerCase() !== first.toLowerCase());
        if (clash !== undefined) {
          const badRow = group.rows.find((r) => r.get(key).trim().toLowerCase() === clash.toLowerCase())!.row;
          throw new Error(`Row ${badRow}: ${columns.find((c) => c.key === key)!.header.replace(" *", "")} "${clash}" does not match the first row of Ref "${group.ref}".`);
        }
        return first;
      };

      const docDate = toIsoDate(consistent("docDate"), "Doc Date");
      const expectedDate = toIsoDate(consistent("expectedDate"), "Expected Date", { required: false });
      const warehouse = warehouseByName(consistent("warehouse"));
      const toWarehouse = warehouseByName(consistent("toWarehouse"));
      const partyName = consistent("partyName") || undefined;
      const type = INVENTORY_DOC_TYPES[slug];

      // Subtype per page.
      const subtypeRaw = consistent("subtype").trim();
      let subtype: string | undefined;
      if (slug === "stock-adjustment") {
        subtype = subtypeRaw ? byName([{ name: "Stock Audit" }, { name: "Stock Adjustment" }, { name: "Damage" }], (o) => o.name, subtypeRaw, "Type")!.name : "Stock Adjustment";
      } else if (slug === "store-requisition" || slug === "store-issue") {
        subtype = subtypeRaw ? byName([{ name: "Employee" }, { name: "Department" }, { name: "Project" }], (o) => o.name, subtypeRaw, "Type")!.name : undefined;
      } else if (slug === "item-stock-conversion") {
        subtype = subtypeRaw ? byName([{ name: "Stock Transfer" }, { name: "Bundle" }, { name: "Un-Bundle" }, { name: "ONE TO ONE" }], (o) => o.name, subtypeRaw, "Type")!.name : "Stock Transfer";
      } else if (slug === "gate-in-out") {
        subtype = byName([{ name: "Gate In" }, { name: "Gate Out" }, { name: "Visitor" }], (o) => o.name, subtypeRaw, "Type")!.name;
        if (subtype === "Visitor" && !partyName) throw new Error("Visitor passes need the Party / For (visitor name).");
      }

      // Fulfil an approved request when a request number is given.
      let requestId: string | undefined;
      const requestNumber = consistent("requestNumber");
      if (requestNumber) {
        const requestType = slug === "transfer" ? "TRANSFER_REQUEST" : slug === "store-issue" ? "STORE_REQUISITION" : null;
        if (!requestType) throw new Error("Request Number only applies to Transfers and Store Issues.");
        const found = await prisma.inventoryDocument.findFirst({
          where: { number: requestNumber, type: requestType },
          select: { id: true, status: true, number: true },
        });
        if (!found) throw new Error(`Request "${requestNumber}" not found.`);
        if (found.status !== "APPROVED") throw new Error(`Request ${found.number} is ${found.status.toLowerCase().replace("_", " ")}, not approved.`);
        requestId = found.id;
      }

      const lines = group.rows.flatMap(({ row, get }) => {
        if (!get("itemCode").trim()) {
          if (slug === "gate-in-out" && !get("qty").trim()) return []; // gate pass without goods
          throw new Error(`Line ${row}: Item Code is required.`);
        }
        const item = itemByCode(get("itemCode"));
        const qty = toNumber(get("qty"), "Qty", { required: true });
        if (qty === 0) throw new Error(`Line ${row}: Qty cannot be 0.`);
        if (slug !== "stock-adjustment" && qty < 0) throw new Error(`Line ${row}: Qty must be greater than 0.`);
        const base = { itemId: item.id, qty, ...(get("lineRemarks").trim() ? { remarks: get("lineRemarks").trim() } : {}) };
        if (slug === "item-stock-conversion") {
          const toItem = itemByCode(get("toItemCode"));
          if (toItem.id === item.id) throw new Error(`Line ${row}: To Item Code must be different from Item Code.`);
          const toQty = toNumber(get("toQty"), "To Qty", { required: true });
          return [{ ...base, toItemId: toItem.id, toQty }];
        }
        return [base];
      });

      if (slug !== "gate-in-out" && lines.length === 0) throw new Error("Add at least one item.");

      // Gate pass meta fields.
      let meta: Record<string, string> | undefined;
      if (slug === "gate-in-out") {
        const pairs: [ColumnKey, string][] = [
          ["refType", "refType"], ["fromAddress", "fromAddress"], ["toAddress", "toAddress"],
          ["vehicleNo", "vehicleNo"], ["vehicleType", "vehicleType"], ["vehicleSize", "vehicleSize"],
          ["driverName", "driverName"], ["driverPhone", "driverPhone"],
          ["weightBefore", "weightBefore"], ["weightAfter", "weightAfter"],
        ];
        const m = Object.fromEntries(pairs.map(([key, metaKey]) => [metaKey, consistent(key)]).filter(([, v]) => v));
        if (Object.keys(m).length) meta = m;
      }

      const directTransferIn = slug === "transfer" && yesNo(consistent("directTransferIn"));
      if (slug === "transfer" && directTransferIn) meta = { ...(meta ?? {}), directTransferIn: "Yes" };

      await createDocument(actor, type, {
        docDate,
        ...(expectedDate ? { expectedDate } : {}),
        ...(warehouse ? { warehouseId: warehouse.id } : {}),
        ...(toWarehouse ? { toWarehouseId: toWarehouse.id } : {}),
        ...(requestId ? { requestId } : {}),
        ...(subtype ? { subtype } : {}),
        ...(partyName ? { partyName } : {}),
        ...(consistent("reference") ? { reference: consistent("reference") } : {}),
        ...(consistent("remarks") ? { remarks: consistent("remarks") } : {}),
        ...(meta ? { meta } : {}),
        lines,
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({ row: group.firstRow, message: describe(error) });
    }
  }
  return result;
}
