import ExcelJS from "exceljs";
import { ZodError } from "zod";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  MAX_IMPORT_ROWS,
  type SupplierFilters,
  type SupplierImportResult,
  type SupplierInput,
} from "../schemas/supplier.schema";
import { createSupplier, getFormOptions, supplierWhere } from "./supplier.service";

/**
 * Excel download and bulk upload for the Supplier Profile. One row per partner;
 * dropdown fields (office, groups, district, thana, tax bracket) are written and
 * read by name. Supplier Details are entered in the form, not in the sheet.
 */

const COLUMNS = [
  { key: "code", header: "Partner Code", width: 14 },
  { key: "name", header: "Partner Name *", width: 30 },
  { key: "office", header: "Office *", width: 24 },
  { key: "mobile", header: "Mobile Number", width: 16 },
  { key: "email", header: "Email", width: 26 },
  { key: "group", header: "Partner Group", width: 18 },
  { key: "subGroup", header: "Sub Group", width: 18 },
  { key: "creditDays", header: "Credit Days", width: 12 },
  { key: "tolerancePercent", header: "Tolerance %", width: 12 },
  { key: "binNumber", header: "BIN Number", width: 16 },
  { key: "tcsPercent", header: "TCS %", width: 10 },
  { key: "vatRegistrationNo", header: "VAT Registration No (Central)", width: 24 },
  { key: "tinNumber", header: "TIN Number", width: 16 },
  { key: "tradeLicenseNo", header: "Trade License Number", width: 20 },
  { key: "isMonthly", header: "Is Monthly", width: 11 },
  { key: "isForeign", header: "Is Foreign Supplier", width: 17 },
  { key: "vdsApplicable", header: "VDS Applicable", width: 15 },
  { key: "vatAccountingNotApplicable", header: "VAT Accounting Not Applicable", width: 26 },
  { key: "isUser", header: "User", width: 8 },
  { key: "billingAddress", header: "Billing Address", width: 34 },
  { key: "district", header: "District", width: 16 },
  { key: "thana", header: "Thana", width: 16 },
  { key: "contactPerson", header: "Contact Person", width: 20 },
  { key: "contactNo", header: "Contact No", width: 16 },
  { key: "taxBracket", header: "Tax Bracket", width: 16 },
  { key: "remarks", header: "Remarks / Notes", width: 30 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
const FLAG_KEYS = ["isMonthly", "isForeign", "vdsApplicable", "vatAccountingNotApplicable", "isUser"] as const;

function newSheet(workbook: ExcelJS.Workbook, extraColumns: { header: string; key: string; width: number }[] = []) {
  const sheet = workbook.addWorksheet("Suppliers", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [...COLUMNS, ...extraColumns].map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF1E3A8A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  header.alignment = { vertical: "middle" };
  return sheet;
}

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Uint8Array> {
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

const yesNo = (value: boolean) => (value ? "Yes" : "No");

// ─── Download ─────────────────────────────────────────────────────────────────

export async function exportSuppliers(actor: Actor, filters: SupplierFilters = {}): Promise<Uint8Array> {
  const suppliers = await db().supplier.findMany({
    where: supplierWhere(actor, filters),
    orderBy: [{ code: "asc" }],
    take: 10_000,
    include: {
      office: { select: { name: true } },
      group: { select: { name: true } },
      subGroup: { select: { name: true } },
      district: { select: { name: true } },
      thana: { select: { name: true } },
      taxBracket: { select: { name: true } },
      _count: { select: { details: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = newSheet(workbook, [{ header: "Supplier Details", key: "detailCount", width: 16 }]);
  for (const s of suppliers) {
    sheet.addRow({
      code: s.code,
      name: s.name,
      office: s.office?.name ?? "",
      mobile: s.phone ?? "",
      email: s.email ?? "",
      group: s.group?.name ?? "",
      subGroup: s.subGroup?.name ?? "",
      creditDays: s.creditDays ?? "",
      tolerancePercent: s.tolerancePercent ? Number(s.tolerancePercent) : "",
      binNumber: s.binNumber ?? "",
      tcsPercent: s.tcsPercent ? Number(s.tcsPercent) : "",
      vatRegistrationNo: s.vatRegistrationNo ?? "",
      tinNumber: s.tinNumber ?? "",
      tradeLicenseNo: s.tradeLicenseNo ?? "",
      isMonthly: yesNo(s.isMonthly),
      isForeign: yesNo(s.isForeign),
      vdsApplicable: yesNo(s.vdsApplicable),
      vatAccountingNotApplicable: yesNo(s.vatAccountingNotApplicable),
      isUser: yesNo(s.isUser),
      billingAddress: s.address ?? "",
      district: s.district?.name ?? "",
      thana: s.thana?.name ?? "",
      contactPerson: s.contactPerson ?? "",
      contactNo: s.billingContactNo ?? "",
      taxBracket: s.taxBracket?.name ?? "",
      remarks: s.remarks ?? "",
      detailCount: s._count.details,
    });
  }
  return toBuffer(workbook);
}

export async function importTemplate(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  newSheet(workbook);
  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 110 }];
  [
    "One row per supplier on the Suppliers sheet. Columns marked * are required.",
    "Office, Partner Group, Sub Group, District, Thana and Tax Bracket must match existing names exactly (case does not matter).",
    "Leave Partner Code empty to have a code generated (SUP-00001 …).",
    "Credit Days: whole days. Tolerance % and TCS %: 0 to 100.",
    "Yes/No columns accept Yes, No, Y, N, True, False, 1 or 0; empty means No.",
    "Supplier Details (vendor addresses) are added in the form after upload.",
  ].forEach((line) => help.addRow([line]));
  return toBuffer(workbook);
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim(); // hyperlink
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue); // formula
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export function parseFlag(raw: string, header: string): boolean {
  const value = raw.toLowerCase();
  if (["", "no", "n", "false", "0"].includes(value)) return false;
  if (["yes", "y", "true", "1"].includes(value)) return true;
  throw new Error(`${header}: use Yes or No.`);
}

const key = (value: string) => value.trim().toLowerCase();

export async function importSuppliers(actor: Actor, bytes: Uint8Array): Promise<SupplierImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.getWorksheet("Suppliers") ?? workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");

  // Map columns by header text so re-ordered sheets still work.
  const headerIndex = new Map<ColumnKey, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const text = key(cellText(cell.value)).replace(/\s*\*$/, "");
    const match = COLUMNS.find((c) => key(c.header).replace(/\s*\*$/, "") === text);
    if (match) headerIndex.set(match.key, column);
  });
  for (const required of ["name", "office"] as const) {
    if (!headerIndex.has(required)) {
      const header = COLUMNS.find((c) => c.key === required)!.header;
      throw new AppError(400, "VALIDATION_ERROR", `Column "${header}" is missing. Use the template.`);
    }
  }

  const rows: { row: number; get: (k: ColumnKey) => string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (k: ColumnKey) => {
      const column = headerIndex.get(k);
      return column ? cellText(row.getCell(column).value) : "";
    };
    if (COLUMNS.every((c) => get(c.key) === "")) return; // blank line
    rows.push({ row: rowNumber, get });
  });
  if (rows.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The sheet has no supplier rows.");
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new AppError(400, "VALIDATION_ERROR", `Upload at most ${MAX_IMPORT_ROWS} suppliers per file.`);
  }

  const options = await getFormOptions(actor);
  const offices = new Map(options.offices.map((o) => [key(o.name), o]));
  const districts = new Map(options.districts.map((d) => [key(d.name), d]));

  const result: SupplierImportResult = { created: 0, errors: [] };
  for (const { row, get } of rows) {
    try {
      const office = offices.get(key(get("office")));
      if (!office) throw new Error(get("office") ? `Office "${get("office")}" not found.` : "Office is required.");

      const lookup = <T extends { name: string }>(list: T[], label: string, value: string, extra: (item: T) => boolean) => {
        if (!value) return undefined;
        const found = list.find((item) => key(item.name) === key(value) && extra(item));
        if (!found) throw new Error(`${label} "${value}" not found.`);
        return found;
      };
      const group = lookup(options.groups, "Partner Group", get("group"), (g) => !g.parentId && g.businessUnitId === office.businessUnitId);
      const subGroup = lookup(options.groups, "Sub Group", get("subGroup"), (g) => !!group && g.parentId === group.id);
      if (get("subGroup") && !group) throw new Error("Sub Group needs a Partner Group.");
      const district = get("district") ? districts.get(key(get("district"))) : undefined;
      if (get("district") && !district) throw new Error(`District "${get("district")}" not found.`);
      const thana = lookup(options.thanas, "Thana", get("thana"), (t) => !!district && t.districtId === district.id);
      const taxBracket = lookup(options.taxBrackets, "Tax Bracket", get("taxBracket"), (t) => t.businessUnitId === office.businessUnitId);

      const flags = Object.fromEntries(
        FLAG_KEYS.map((flag) => [flag, parseFlag(get(flag), COLUMNS.find((c) => c.key === flag)!.header)]),
      ) as Record<(typeof FLAG_KEYS)[number], boolean>;

      const input: SupplierInput = {
        officeId: office.id,
        name: get("name"),
        code: get("code"),
        mobile: get("mobile"),
        email: get("email"),
        groupId: group?.id ?? "",
        subGroupId: subGroup?.id ?? "",
        creditDays: get("creditDays"),
        tolerancePercent: get("tolerancePercent"),
        binNumber: get("binNumber"),
        tcsPercent: get("tcsPercent"),
        vatRegistrationNo: get("vatRegistrationNo"),
        tinNumber: get("tinNumber"),
        tradeLicenseNo: get("tradeLicenseNo"),
        ...flags,
        billingAddress: get("billingAddress"),
        districtId: district?.id ?? "",
        thanaId: thana?.id ?? "",
        contactPerson: get("contactPerson"),
        contactNo: get("contactNo"),
        taxBracketId: taxBracket?.id ?? "",
        remarks: get("remarks"),
        details: [],
      };
      await createSupplier(actor, input);
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}

export function describe(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "Row"}: ${issue.message}`).join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Could not import this row.";
}
