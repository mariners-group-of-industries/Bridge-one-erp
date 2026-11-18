import { purchaseStore, type PurchaseActor } from "@/lib/purchase-store/store";
import {
  buildTemplate,
  parseFlatSheet,
  toIsoDate,
  toNumber,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { parseFlag, describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { officeByName, loadPurchaseLookups, supplierByName } from "./purchase-lookups";

/**
 * Supplier Payment bulk upload. One row per payment; the payment is booked as
 * unallocated (no bill/GRN link) or as an advance when "Advance = Yes".
 */

const COLUMNS = [
  { key: "paymentDate", header: "Payment Date *", width: 16 },
  { key: "supplier", header: "Supplier *", width: 30 },
  { key: "office", header: "Office", width: 22 },
  { key: "method", header: "Method", width: 14 },
  { key: "amount", header: "Amount *", width: 16 },
  { key: "referenceNumber", header: "Reference Number", width: 22 },
  { key: "narration", header: "Narration", width: 40 },
  { key: "advance", header: "Advance (Yes/No)", width: 16 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  paymentDate: ["payment date", "date", "paid on"],
  supplier: ["supplier", "supplier name", "vendor", "partner"],
  office: ["office", "office name", "branch"],
  method: ["method", "payment method", "mode"],
  amount: ["amount", "paid amount", "payment amount"],
  referenceNumber: ["reference number", "reference no", "reference", "cheque number", "cheque no", "instrument no"],
  narration: ["narration", "remarks", "notes", "description", "particulars"],
  advance: ["advance", "advance (yes/no)", "is advance"],
};

const METHODS: Record<string, string> = {
  cash: "CASH",
  bank: "BANK",
  cheque: "CHEQUE",
  "cheque / pay-order": "CHEQUE",
  online: "ONLINE",
  "online transfer": "ONLINE",
  transfer: "ONLINE",
  neft: "ONLINE",
  rtgs: "ONLINE",
  beftn: "ONLINE",
};

export async function supplierPaymentImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Supplier Payments", COLUMNS, [
    "One row per payment. Columns marked * are required.",
    "Supplier and Office must match existing names exactly (case does not matter).",
    "Method: Cash, Bank, Cheque or Online (default Bank). Cheque payments need the Reference Number (cheque number).",
    "Excel creates unallocated payments — to settle a specific bill or GRN, do it from Purchase › Supplier Payments.",
    "Advance = Yes books the payment as an advance (paid before any receipt/bill).",
    "Amount is a positive number; decimals are fine. Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importSupplierPayments(actor: PurchaseActor & { name?: string }, actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { rows } = await parseFlatSheet(bytes, "Supplier Payments", COLUMNS, ALIASES, "supplier", [
    "paymentDate",
    "supplier",
    "amount",
  ]);
  const lookups = await loadPurchaseLookups(actor);
  const result: ImportResult = { created: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      const supplier = supplierByName(lookups, get("supplier"));
      const office = get("office").trim() ? officeByName(lookups, get("office")) : undefined;
      const paymentDate = toIsoDate(get("paymentDate"), "Payment Date");
      const amount = toNumber(get("amount"), "Amount", { required: true });
      if (!(amount > 0)) throw new Error("Amount must be greater than 0.");
      const methodRaw = get("method").trim().toLowerCase();
      const method = methodRaw ? METHODS[methodRaw] : "BANK";
      if (!method) throw new Error("Method: use Cash, Bank, Cheque or Online.");
      const referenceNumber = get("referenceNumber").trim();
      if (method === "CHEQUE" && !referenceNumber) throw new Error("Cheque payments need the Reference Number (cheque number).");

      await purchaseStore.createSupplierPayment(
        {
          supplierId: supplier.id,
          ...(office ? { officeId: office.id } : {}),
          amount,
          method,
          paymentDate,
          ...(referenceNumber ? { referenceNumber } : {}),
          ...(get("narration").trim() ? { narration: get("narration").trim() } : {}),
          isAdvance: parseFlag(get("advance"), "Advance"),
        },
        actorName,
        actor,
      );
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
