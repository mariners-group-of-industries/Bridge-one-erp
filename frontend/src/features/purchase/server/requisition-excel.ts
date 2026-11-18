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
import { loadPurchaseLookups, officeByName, warehouseByName, itemByCode } from "./purchase-lookups";

/**
 * Purchase Requisition bulk upload. One row per line item; rows with the same
 * Ref make one requisition. Offices/warehouses are matched by name, items by code.
 */

const COLUMNS = [
  { key: "ref", header: "Ref *", width: 12 },
  { key: "requestDate", header: "Request Date *", width: 15 },
  { key: "requiredDeliveryDate", header: "Required Delivery Date *", width: 20 },
  { key: "office", header: "Office *", width: 22 },
  { key: "warehouse", header: "Warehouse *", width: 20 },
  { key: "department", header: "Department *", width: 18 },
  { key: "section", header: "Section", width: 18 },
  { key: "requestType", header: "Request Type", width: 15 },
  { key: "purchaseMethod", header: "Purchase Method", width: 17 },
  { key: "requesterName", header: "Requester Name *", width: 24 },
  { key: "justification", header: "Business Justification", width: 40 },
  { key: "remarks", header: "Remarks", width: 30 },
  { key: "itemCode", header: "Item Code *", width: 16 },
  { key: "quantity", header: "Quantity *", width: 12 },
  { key: "estimatedUnitPrice", header: "Est. Unit Price *", width: 16 },
  { key: "lineRemarks", header: "Line Remarks", width: 30 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  ref: ["ref", "reference", "doc ref", "document ref", "group", "doc key"],
  requestDate: ["request date", "date", "requisition date"],
  requiredDeliveryDate: ["required delivery date", "delivery date", "required date", "required on", "needed by"],
  office: ["office", "office name", "branch"],
  warehouse: ["warehouse", "warehouse name", "store", "godown"],
  department: ["department", "dept", "section dept"],
  section: ["section"],
  requestType: ["request type", "type", "inventory type"],
  purchaseMethod: ["purchase method", "method"],
  requesterName: ["requester name", "requester", "requested by", "for"],
  justification: ["business justification", "justification", "reason", "purpose"],
  remarks: ["remarks", "remarks / notes", "notes", "comment"],
  itemCode: ["item code", "item", "code", "item no", "item number"],
  quantity: ["quantity", "qty", "qty requested", "req qty"],
  estimatedUnitPrice: ["est. unit price", "est unit price", "estimated price", "unit price", "rate", "price"],
  lineRemarks: ["line remarks", "line notes"],
};

const REQUEST_TYPES: Record<string, string> = {
  local: "LOCAL",
  import: "IMPORT",
  "inter-branch": "INTER_BRANCH",
  interbranch: "INTER_BRANCH",
  "inter branch": "INTER_BRANCH",
  urgent: "URGENT",
};
const PURCHASE_METHODS: Record<string, string> = {
  direct: "DIRECT",
  quotation: "QUOTATION",
  tender: "TENDER",
  contract: "CONTRACT",
  "rate contract": "CONTRACT",
};

const pickEnum = (map: Record<string, string>, raw: string, label: string, fallback: string) => {
  if (!raw.trim()) return fallback;
  const found = map[raw.trim().toLowerCase()];
  if (!found) throw new Error(`${label}: use one of ${[...new Set(Object.values(map))].join(", ")}.`);
  return found;
};

export async function requisitionImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Requisitions", COLUMNS, [
    "One row per item line. Columns marked * are required.",
    "Rows with the same Ref (any text you choose, e.g. 1, 2, REQ-001) are saved as one requisition.",
    "Header columns (everything before Item Code) only need values on the first row of each Ref; every row of a Ref must agree on them.",
    "Office and Warehouse must match existing names exactly (case does not matter). The warehouse must belong to the office.",
    "Request Type: Local, Import, Inter-Branch or Urgent (default Local). Purchase Method: Direct, Quotation, Tender or Contract (default Direct).",
    "Requester Name: who the requisition is for. Business Justification may be left empty; it defaults from the requester.",
    "Item Code: existing active items (Configuration › Item Profile). Quantity and Est. Unit Price are numbers; the line total is calculated.",
    "Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work). Delete this Instructions sheet before uploading if you like.",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importRequisitions(actor: PurchaseActor & { name?: string }, actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { groups } = await parseLineSheet(bytes, "Requisitions", COLUMNS, ALIASES, "itemCode", [
    "ref",
    "requestDate",
    "requiredDeliveryDate",
    "office",
    "warehouse",
    "department",
    "requesterName",
    "itemCode",
  ]);
  const lookups = await loadPurchaseLookups(actor);
  const result: ImportResult = { created: 0, errors: [] };

  for (const group of groups) {
    try {
      // Header values come from the first row; later rows must agree.
      const header = group.rows[0];
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
      const requestDate = toIsoDate(consistent("requestDate"), "Request Date");
      const requiredDeliveryDate = toIsoDate(consistent("requiredDeliveryDate"), "Required Delivery Date");
      const requesterName = consistent("requesterName");
      if (!requesterName) throw new Error("Requester Name is required.");
      const department = consistent("department");
      if (!department) throw new Error("Department is required.");
      const remarks = consistent("remarks");
      const justification =
        consistent("justification") || remarks || `Requisition requested by ${requesterName} for operational requirements`;

      const items = group.rows.map(({ row, get }) => {
        try {
          const item = itemByCode(lookups, get("itemCode"));
          const quantity = toNumber(get("quantity"), "Quantity", { required: true });
          if (quantity <= 0) throw new Error("Quantity must be greater than 0.");
          const estimatedUnitPrice = toNumber(get("estimatedUnitPrice"), "Est. Unit Price", { required: true });
          if (estimatedUnitPrice < 0) throw new Error("Est. Unit Price cannot be negative.");
          return {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            uom: item.uom,
            quantity,
            estimatedUnitPrice,
            lineTotal: round2(priceLine(quantity, estimatedUnitPrice).lineTotal),
            ...(get("lineRemarks") ? { remarks: get("lineRemarks") } : {}),
          };
        } catch (error) {
          throw new Error(`Line ${row}: ${describe(error)}`);
        }
      });

      await purchaseStore.createRequisition(
        {
          companyId: "comp-bridgeone-01",
          officeId: office.id,
          warehouseId: warehouse.id,
          department,
          ...(consistent("section") ? { section: consistent("section") } : {}),
          requestType: pickEnum(REQUEST_TYPES, consistent("requestType"), "Request Type", "LOCAL") as never,
          purchaseMethod: pickEnum(PURCHASE_METHODS, consistent("purchaseMethod"), "Purchase Method", "DIRECT") as never,
          requesterName,
          requestDate,
          requiredDeliveryDate,
          businessJustification: justification,
          ...(remarks ? { remarks } : {}),
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
