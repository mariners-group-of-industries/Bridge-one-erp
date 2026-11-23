import {
  buildTemplate,
  parseLineSheet,
  toIsoDate,
  toNumber,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import type { Actor } from "@/lib/auth/actor";
import {
  accountByCode,
  costCenterByName,
  employeeByName,
  loadAccountLookups,
  officeByName,
  partnerByName,
} from "./account-lookups";
import { createJournalVoucher } from "./journal.service";

/**
 * Journal voucher bulk upload. One row per account line; rows with the same Ref
 * make one voucher. Debits must equal credits inside each Ref. Accounts are
 * matched by code, offices/cost centers by name or code, partners by name.
 */

const COLUMNS = [
  { key: "ref", header: "Ref *", width: 12 },
  { key: "transactionDate", header: "Transaction Date *", width: 18 },
  { key: "office", header: "Office *", width: 22 },
  { key: "journalType", header: "Journal Type", width: 17 },
  { key: "referenceNumber", header: "Reference Number", width: 20 },
  { key: "narration", header: "Narration *", width: 40 },
  { key: "employeeName", header: "Employee Name", width: 22 },
  { key: "projectName", header: "Project (Cost Center)", width: 22 },
  { key: "accountCode", header: "Account Code *", width: 16 },
  { key: "debit", header: "Debit", width: 14 },
  { key: "credit", header: "Credit", width: 14 },
  { key: "costCenter", header: "Cost Center", width: 20 },
  { key: "lineNarration", header: "Line Narration", width: 30 },
  { key: "partnerType", header: "Partner Type", width: 15 },
  { key: "partnerName", header: "Partner Name", width: 24 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  ref: ["ref", "reference", "doc ref", "document ref", "group", "voucher ref", "jv ref"],
  transactionDate: ["transaction date", "date", "voucher date", "jv date"],
  office: ["office", "office name", "branch"],
  journalType: ["journal type", "type", "jv type"],
  referenceNumber: ["reference number", "reference no", "reference"],
  narration: ["narration", "description", "particulars", "remarks", "details"],
  employeeName: ["employee name", "employee", "for employee"],
  projectName: ["project (cost center)", "project", "project name"],
  accountCode: ["account code", "gl code", "account", "gl account", "ledger code"],
  debit: ["debit", "dr", "debit amount"],
  credit: ["credit", "cr", "credit amount"],
  costCenter: ["cost center", "cost centre", "cc"],
  lineNarration: ["line narration", "line description", "line remarks"],
  partnerType: ["partner type", "party type", "partner"],
  partnerName: ["partner name", "party name", "customer name", "supplier name"],
};

const JOURNAL_TYPES: Record<string, string> = {
  general: "GENERAL",
  cash: "CASH",
  bank: "BANK",
  payment: "PAYMENT",
  receipt: "RECEIPT",
  adjustment: "ADJUSTMENT",
};

export async function journalImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Journal Vouchers", COLUMNS, [
    "One row per account line. Columns marked * are required.",
    "Rows with the same Ref (any text you choose, e.g. 1, 2, JV-001) are saved as one voucher.",
    "Header columns (Transaction Date … Project) only need values on the first row of each Ref; every row of a Ref must agree on them.",
    "Total debits must equal total credits inside each Ref; at least two lines per Ref.",
    "Office and Cost Center must match existing names (or codes) exactly; the office must be in your access.",
    "Account Code: the GL account code (e.g. 10101001). Each line carries either a Debit or a Credit, not both.",
    "Partner Type/Name are optional: CUSTOMER, SUPPLIER or EMPLOYEE, matched by name.",
    "Journal Type: GENERAL, CASH, BANK, PAYMENT, RECEIPT or ADJUSTMENT (default GENERAL).",
    "Without the Approve permission the voucher is saved as Pending for an approver to post.",
    "Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importJournalVouchers(actor: Actor, _actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { groups } = await parseLineSheet(bytes, "Journal Vouchers", COLUMNS, ALIASES, "accountCode", [
    "ref",
    "transactionDate",
    "office",
    "narration",
    "accountCode",
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

      const office = officeByName(lookups, consistent("office"));
      const transactionDate = toIsoDate(consistent("transactionDate"), "Transaction Date");
      const narration = consistent("narration");
      if (!narration) throw new Error("Narration is required.");
      const journalTypeRaw = consistent("journalType").trim().toLowerCase();
      const journalType = journalTypeRaw ? JOURNAL_TYPES[journalTypeRaw] : "GENERAL";
      if (journalTypeRaw && !journalType) throw new Error("Journal Type: use GENERAL, CASH, BANK, PAYMENT, RECEIPT or ADJUSTMENT.");
      const employee = employeeByName(lookups, consistent("employeeName"));
      const project = costCenterByName(lookups, consistent("projectName"));

      const lines = group.rows.map(({ row, get }) => {
        try {
          const account = accountByCode(lookups, get("accountCode"));
          const debit = toNumber(get("debit"), "Debit");
          const credit = toNumber(get("credit"), "Credit");
          if (debit > 0 && credit > 0) throw new Error("Enter either Debit or Credit on a line, not both.");
          if (debit === 0 && credit === 0) throw new Error("Enter a Debit or a Credit amount.");
          const costCenter = costCenterByName(lookups, get("costCenter"));
          const partnerTypeRaw = get("partnerType").trim();
          const partnerName = get("partnerName").trim();
          const partner = partnerTypeRaw || partnerName ? partnerByName(lookups, partnerTypeRaw, partnerName) : undefined;
          return {
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            debit,
            credit,
            ...(costCenter ? { costCenterId: costCenter.id } : {}),
            ...(get("lineNarration").trim() ? { narration: get("lineNarration").trim() } : {}),
            ...(partner ? { partnerType: partner.partnerType, partnerId: partner.id, partnerName: partner.name } : {}),
          };
        } catch (error) {
          throw new Error(`Line ${row}: ${describe(error)}`);
        }
      });

      await createJournalVoucher(actor, {
        transactionDate,
        officeId: office.id,
        officeName: office.name,
        journalType,
        ...(consistent("referenceNumber") ? { referenceNumber: consistent("referenceNumber") } : {}),
        narration,
        ...(employee ? { employeeId: employee.id, employeeName: employee.name } : {}),
        ...(project ? { projectId: project.id, projectName: project.name } : {}),
        lines,
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({ row: group.firstRow, message: describe(error) });
    }
  }
  return result;
}
