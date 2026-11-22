import {
  buildTemplate,
  parseFlatSheet,
  toIsoDate,
  toNumber,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import type { Actor } from "@/lib/auth/actor";
import { accountByCode, loadAccountLookups, officeByName } from "./account-lookups";
import { db } from "@/lib/prisma/client";

/**
 * Fund transfer request bulk upload. One row per transfer; requests are saved as
 * SUBMITTED for approval. Offices are matched by name, bank/cash accounts by GL code.
 */

const COLUMNS = [
  { key: "requestDate", header: "Request Date *", width: 16 },
  { key: "expectedDate", header: "Expected Date", width: 16 },
  { key: "fromOffice", header: "From Office *", width: 22 },
  { key: "toOffice", header: "To Office *", width: 22 },
  { key: "fromAccount", header: "From Account (GL Code)", width: 22 },
  { key: "toAccount", header: "To Account (GL Code)", width: 22 },
  { key: "requestedAmount", header: "Requested Amount *", width: 19 },
  { key: "purpose", header: "Purpose *", width: 36 },
  { key: "responsiblePerson", header: "Responsible Person", width: 24 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  requestDate: ["request date", "date", "transfer date"],
  expectedDate: ["expected date", "required by", "expected on"],
  fromOffice: ["from office", "from", "source office", "from branch"],
  toOffice: ["to office", "to", "destination office", "to branch"],
  fromAccount: ["from account (gl code)", "from account", "from gl code", "from account code", "from bank"],
  toAccount: ["to account (gl code)", "to account", "to gl code", "to account code", "to bank"],
  requestedAmount: ["requested amount", "amount", "transfer amount"],
  purpose: ["purpose", "reason", "description", "narration"],
  responsiblePerson: ["responsible person", "responsible", "requested by"],
};

export async function fundTransferImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Fund Transfers", COLUMNS, [
    "One row per transfer request. Columns marked * are required.",
    "From/To Office must match existing offices in your access; accounts are matched by GL code.",
    "Transfers are saved as SUBMITTED and wait for approval — the needed amount can be entered there.",
    "Requested Amount is a positive number. Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importFundTransfers(actor: Actor, _actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { rows } = await parseFlatSheet(bytes, "Fund Transfers", COLUMNS, ALIASES, "fromOffice", [
    "requestDate",
    "fromOffice",
    "toOffice",
    "requestedAmount",
    "purpose",
  ]);
  const lookups = await loadAccountLookups(actor);
  const prisma = db();
  const result: ImportResult = { created: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      const requestDate = toIsoDate(get("requestDate"), "Request Date");
      const expectedDate = toIsoDate(get("expectedDate"), "Expected Date", { required: false });
      const fromOffice = officeByName(lookups, get("fromOffice"));
      const toOffice = officeByName(lookups, get("toOffice"));
      if (fromOffice.id === toOffice.id) throw new Error("From Office and To Office must be different.");
      const fromAccountRaw = get("fromAccount").trim();
      const toAccountRaw = get("toAccount").trim();
      const fromAccount = fromAccountRaw ? accountByCode(lookups, fromAccountRaw, "From Account") : undefined;
      const toAccount = toAccountRaw ? accountByCode(lookups, toAccountRaw, "To Account") : undefined;
      const requestedAmount = toNumber(get("requestedAmount"), "Requested Amount", { required: true });
      if (!(requestedAmount > 0)) throw new Error("Requested Amount must be greater than 0.");
      const purpose = get("purpose").trim();
      if (!purpose) throw new Error("Purpose is required.");

      const num = `FT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      await prisma.fundTransfer.create({
        data: {
          transferNumber: num,
          requestCode: `REQ-${num}`,
          requestDate: new Date(`${requestDate}T00:00:00.000Z`),
          expectedDate: expectedDate ? new Date(`${expectedDate}T00:00:00.000Z`) : null,
          fromOfficeId: fromOffice.id,
          fromOfficeName: fromOffice.name,
          toOfficeId: toOffice.id,
          toOfficeName: toOffice.name,
          fromAccountId: fromAccount?.id ?? null,
          fromAccountName: fromAccount?.name ?? "",
          toAccountId: toAccount?.id ?? null,
          toAccountName: toAccount?.name ?? "",
          requestedAmount,
          approvedAmount: 0,
          transferredAmount: 0,
          receivedAmount: 0,
          responsiblePerson: get("responsiblePerson").trim(),
          purpose,
          status: "SUBMITTED",
        },
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
