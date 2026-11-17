import {
  buildTemplate,
  parseFlatSheet,
  toIsoDate,
  type DocColumn,
} from "@/lib/bulk-import/kit";
import { describe } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import type { Actor } from "@/lib/auth/actor";
import { loadAccountLookups, officeByName } from "./account-lookups";
import { db } from "@/lib/prisma/client";

/**
 * Cost center bulk upload. One row per cost center; the center is saved ACTIVE.
 * Office is matched by name; Type defaults to DEPARTMENT.
 */

const COLUMNS = [
  { key: "code", header: "Center Code *", width: 17 },
  { key: "name", header: "Center Name *", width: 28 },
  { key: "type", header: "Type", width: 17 },
  { key: "office", header: "Office *", width: 22 },
  { key: "effectiveDate", header: "Effective Date", width: 16 },
  { key: "description", header: "Description", width: 36 },
] as const satisfies readonly DocColumn[];

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ALIASES: Partial<Record<ColumnKey, string[]>> = {
  code: ["center code", "code", "cost center code", "cc code"],
  name: ["center name", "name", "cost center name", "cc name"],
  type: ["type", "center type"],
  office: ["office", "office name", "branch"],
  effectiveDate: ["effective date", "from date", "effective from"],
  description: ["description", "remarks", "notes"],
};

const TYPES = new Set(["DEPARTMENT", "PROJECT", "BRANCH", "LOCATION", "OTHER"]);

export async function costCenterImportTemplate(): Promise<Uint8Array> {
  return buildTemplate("Cost Centers", COLUMNS, [
    "One row per cost center. Columns marked * are required.",
    "Center Code must be unique; a code already in use is reported and skipped.",
    "Type: DEPARTMENT, PROJECT, BRANCH, LOCATION or OTHER (default DEPARTMENT).",
    "Office must match an existing office in your access.",
    "Dates: YYYY-MM-DD (DD.MM.YYYY and DD/MM/YYYY also work).",
  ]);
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export async function importCostCenters(actor: Actor, _actorName: string, bytes: Uint8Array): Promise<ImportResult> {
  const { rows } = await parseFlatSheet(bytes, "Cost Centers", COLUMNS, ALIASES, "code", [
    "code",
    "name",
    "office",
  ]);
  const lookups = await loadAccountLookups(actor);
  const prisma = db();
  const result: ImportResult = { created: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      const code = get("code").trim();
      const name = get("name").trim();
      if (!code) throw new Error("Center Code is required.");
      if (!name) throw new Error("Center Name is required.");
      const typeRaw = get("type").trim().toUpperCase();
      if (typeRaw && !TYPES.has(typeRaw)) throw new Error("Type: use DEPARTMENT, PROJECT, BRANCH, LOCATION or OTHER.");
      const office = officeByName(lookups, get("office"));
      const effectiveDateRaw = get("effectiveDate").trim();
      const effectiveDate = effectiveDateRaw ? toIsoDate(effectiveDateRaw, "Effective Date") : null;

      if (await prisma.costCenter.findUnique({ where: { code }, select: { id: true } })) {
        throw new Error(`Center code ${code} is already used.`);
      }
      await prisma.costCenter.create({
        data: {
          code,
          name,
          type: typeRaw || "DEPARTMENT",
          officeId: office.id,
          officeName: office.name,
          description: get("description").trim() || null,
          effectiveDate: effectiveDate ? new Date(`${effectiveDate}T00:00:00.000Z`) : null,
          status: "ACTIVE",
        },
      });
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
