import {
  buildTemplate,
  parseLineSheet,
  toIsoDate,
  toNumber,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import type { Actor } from "@/lib/auth/actor";
import { accountByCode, employeeByName, loadAccountLookups, officeByName } from "./account-lookups";
import { createExpenseRecord } from "./expense.service";
import { db } from "@/lib/prisma/client";

/**
 * Expense bulk upload. One row per GL line; rows with the same Ref make one
 * expense record (record kind EXPENSE or PROVISION). The expense amount is the
 * sum of its lines.
 */

const COLUMNS = [
  { key: "ref", header: "Ref *", width: 12 },
  { key: "recordKind", header: "Record Kind *", width: 17 },
  { key: "date", header: "Date *", width: 15 },
  { key: "office", header: "Office *", width: 22 },
  { key: "category", header: "Category", width: 18 },
  { key: "employeeName", header: "Employee Name", width: 22 },
  { key: "supplierName", header: "Supplier Name", width: 24 },
  { key: "department", header: "Department", width: 16 },
  { key: "paymentMethod", header: "Payment Method", width: 17 },
  { key: "referenceNumber", header: "Reference Number", width: 20 },
  { key: "effectivePeriod", header: "Effective Period", width: 18 },
  { key: "description", header: "Description", width: 36 },
  { key: "accountCode", header: "Account Code *", width: 16 },
  { key: "amount", header: "Amount *", width: 15 },
  { key: "subGl", header: "Sub-GL", width: 16 },
  { key: "lineRemarks", header: "Line Remarks", width: 28 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  ref: ["ref", "reference", "doc ref", "document ref", "group", "expense ref"],
  recordKind: ["record kind", "kind", "type"],
  date: ["date", "expense date", "voucher date"],
  office: ["office", "office name", "branch"],
  category: ["category", "payee category", "expense category"],
  employeeName: ["employee name", "employee"],
  supplierName: ["supplier name", "supplier", "vendor", "principle"],
  department: ["department", "dept"],
  paymentMethod: ["payment method", "method", "mode"],
  referenceNumber: ["reference number", "reference no", "reference"],
  effectivePeriod: ["effective period", "period"],
  description: ["description", "narration", "remarks", "particulars", "details"],
  accountCode: ["account code", "gl code", "account", "gl account", "expense head", "chart of accounts"],
  amount: ["amount", "debit", "value"],
  subGl: ["sub-gl", "sub gl", "subgl", "sub ledger"],
  lineRemarks: ["line remarks", "line notes"],
};

const CATEGORIES: Record<string, string> = {
  employee: "Employee",
  "partner/supplier": "Partner/Supplier",
  "partner / supplier": "Partner/Supplier",
  supplier: "Partner/Supplier",
  project: "Project",
};
const METHODS = new Set(["CASH", "BANK", "CHEQUE", "ONLINE", "MOBILE_BANKING"]);

export async function expenseImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Expenses", COLUMNS, [
    "One row per GL line. Columns marked * are required.",
    "Rows with the same Ref (any text you choose, e.g. 1, 2, EXP-001) are saved as one expense record.",
    "Record Kind: EXPENSE or PROVISION. A provision also posts its JV automatically. For advances use Accounts › Expenses.",
    "Header columns (Record Kind … Description) only need values on the first row of each Ref; every row of a Ref must agree on them.",
    "Category: Employee, Partner/Supplier or Project. For Employee rows put the Employee Name (existing employee); for Partner/Supplier rows put the Supplier Name.",
    "Account Code: the GL account code for each line (e.g. 50101001). Amount is the line's value; the expense total is their sum.",
    "Payment Method: Cash, Bank, Cheque, Online or Mobile Banking (default Bank).",
    "Office must match an existing office in your access. Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importExpenses(actor: Actor, _actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { groups } = await parseLineSheet(bytes, "Expenses", COLUMNS, ALIASES, "accountCode", [
    "ref",
    "recordKind",
    "date",
    "office",
    "accountCode",
    "amount",
  ]);
  const lookups = await loadAccountLookups(actor);
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

      const kindRaw = consistent("recordKind").trim().toUpperCase();
      if (kindRaw !== "EXPENSE" && kindRaw !== "PROVISION") {
        throw new Error("Record Kind: use EXPENSE or PROVISION (advances are made from Accounts › Expenses).");
      }
      const office = officeByName(lookups, consistent("office"));
      const date = toIsoDate(consistent("date"), "Date");
      const employeeName = consistent("employeeName");
      const supplierName = consistent("supplierName");
      const employee = employeeByName(lookups, employeeName);
      let supplier: { id: string; name: string } | undefined;
      if (supplierName) {
        supplier = await db().supplier.findFirst({
          where: { name: { equals: supplierName, mode: "insensitive" }, isActive: true },
          select: { id: true, name: true },
        }) ?? undefined;
        if (!supplier) throw new Error(`Supplier "${supplierName}" not found.`);
      }
      const categoryRaw = consistent("category").trim().toLowerCase();
      const category = categoryRaw ? CATEGORIES[categoryRaw] : employee ? "Employee" : supplier ? "Partner/Supplier" : "Employee";
      if (categoryRaw && !category) throw new Error("Category: use Employee, Partner/Supplier or Project.");
      const payeeName = employee?.name ?? supplier?.name ?? "";
      const paymentMethodRaw = consistent("paymentMethod").trim().toUpperCase().replace(/\s+/g, "_");
      if (paymentMethodRaw && !METHODS.has(paymentMethodRaw)) {
        throw new Error("Payment Method: use Cash, Bank, Cheque, Online or Mobile Banking.");
      }

      const lines = group.rows.map(({ row, get }) => {
        try {
          const account = accountByCode(lookups, get("accountCode"), "Account Code");
          const amount = toNumber(get("amount"), "Amount", { required: true });
          if (!(amount > 0)) throw new Error("Amount must be greater than zero.");
          return {
            date,
            accountId: account.id,
            subGl: get("subGl").trim() || null,
            remarks: get("lineRemarks").trim() || null,
            amount,
          };
        } catch (error) {
          throw new Error(`Line ${row}: ${describe(error)}`);
        }
      });

      await createExpenseRecord(actor, {
        recordKind: kindRaw,
        date,
        officeId: office.id,
        officeName: office.name,
        expenseType: category,
        payeeName,
        ...(employee ? { employeeId: employee.id, employeeName: employee.name } : {}),
        ...(supplier ? { supplierId: supplier.id, supplierName: supplier.name } : {}),
        department: consistent("department") || null,
        paymentMethod: paymentMethodRaw || "BANK",
        referenceNumber: consistent("referenceNumber") || null,
        effectivePeriod: consistent("effectivePeriod") || null,
        description: consistent("description") || null,
        lines,
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({ row: group.firstRow, message: describe(error) });
    }
  }
  return result;
}
