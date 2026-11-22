import {
  buildTemplate,
  parseFlatSheet,
  toIsoDate,
  toNumber,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import type { Actor } from "@/lib/auth/actor";
import { accountByCode, costCenterByName, loadAccountLookups, officeByName } from "./account-lookups";
import { createBudget } from "./budget.service";

/**
 * Budget bulk upload. One row per budget (no monthly split — edit the budget in
 * the form to set monthly amounts). Offices and cost centers are matched by
 * name or code, the GL account by code.
 */

const COLUMNS = [
  { key: "budgetName", header: "Budget Name *", width: 28 },
  { key: "budgetYear", header: "Budget Year", width: 14 },
  { key: "budgetType", header: "Budget Type", width: 15 },
  { key: "fromPeriod", header: "From Period", width: 16 },
  { key: "toPeriod", header: "To Period", width: 16 },
  { key: "office", header: "Office", width: 22 },
  { key: "costCenter", header: "Cost Center", width: 22 },
  { key: "accountCode", header: "Account Code (GL)", width: 19 },
  { key: "allocatedAmount", header: "Allocated Amount *", width: 19 },
  { key: "remarks", header: "Remarks", width: 32 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  budgetName: ["budget name", "name", "budget"],
  budgetYear: ["budget year", "year", "fiscal year"],
  budgetType: ["budget type", "type"],
  fromPeriod: ["from period", "from", "period from", "start"],
  toPeriod: ["to period", "to", "period to", "end"],
  office: ["office", "office name", "branch"],
  costCenter: ["cost center", "cost centre", "cc"],
  accountCode: ["account code (gl)", "account code", "account", "gl code", "head code"],
  allocatedAmount: ["allocated amount", "amount", "budget amount", "total budget"],
  remarks: ["remarks", "notes", "comment"],
};

export async function budgetImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Budgets", COLUMNS, [
    "One row per budget. Columns marked * are required.",
    "Budget Type: Expense, Revenue or Capital (default Expense).",
    "Office and Cost Center must match existing names (or codes); the GL Account is matched by code.",
    "From/To Period are dates (YYYY-MM-DD). Allocated Amount is the total for the budget.",
    "Month-by-month amounts are not supported here; open the budget in Accounts › Budget to add them.",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importBudgets(actor: Actor, _actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { rows } = await parseFlatSheet(bytes, "Budgets", COLUMNS, ALIASES, "budgetName", [
    "budgetName",
    "allocatedAmount",
  ]);
  const lookups = await loadAccountLookups(actor);
  const result: ImportResult = { created: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      const budgetName = get("budgetName").trim();
      if (!budgetName) throw new Error("Budget Name is required.");
      const budgetTypeRaw = get("budgetType").trim().toLowerCase();
      const budgetType = budgetTypeRaw === "revenue" ? "Revenue" : budgetTypeRaw === "capital" ? "Capital" : "Expense";
      const fromPeriod = toIsoDate(get("fromPeriod"), "From Period", { required: false });
      const toPeriod = toIsoDate(get("toPeriod"), "To Period", { required: false });
      const officeRaw = get("office").trim();
      const office = officeRaw ? officeByName(lookups, officeRaw) : undefined;
      const costCenterRaw = get("costCenter").trim();
      const costCenter = costCenterByName(lookups, costCenterRaw);
      const accountRaw = get("accountCode").trim();
      const account = accountRaw ? accountByCode(lookups, accountRaw, "Account Code") : undefined;
      const allocatedAmount = toNumber(get("allocatedAmount"), "Allocated Amount", { required: true });
      if (!(allocatedAmount >= 0)) throw new Error("Allocated Amount cannot be negative.");

      await createBudget(actor, {
        budgetName,
        budgetYear: get("budgetYear").trim(),
        budgetType,
        ...(fromPeriod ? { fromPeriod } : {}),
        ...(toPeriod ? { toPeriod } : {}),
        ...(office ? { officeId: office.id, officeName: office.name } : {}),
        ...(costCenter ? { costCenterId: costCenter.id, costCenterName: costCenter.name } : {}),
        ...(account ? { accountId: account.id, accountName: account.name } : {}),
        allocatedAmount,
        ...(get("remarks").trim() ? { remarks: get("remarks").trim() } : {}),
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
