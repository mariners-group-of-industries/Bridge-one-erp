import ExcelJS from "exceljs";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { cellText, describe } from "../../supplier/server/supplier-excel";
import { createEmployeeSchema, type CreateEmployeeInput } from "../schemas/employee.schema";
import { createEmployee } from "./employee.service";

/**
 * Bulk upload for Employee Management: one row per employee with the official
 * and personal fields of the "New Employee" form. Office is matched by name.
 * Salary, academic records, documents and ERP access are added per employee later.
 */

export const MAX_EMPLOYEE_IMPORT_ROWS = 2000;

export interface EmployeeImportResult {
  created: number;
  /** Row numbers are the spreadsheet's (header is row 1). */
  errors: { row: number; message: string }[];
}

const COLUMNS = [
  { key: "employeeCode", header: "Employee ID *", width: 14 },
  { key: "attendanceId", header: "Attendance ID", width: 14 },
  { key: "name", header: "Employee Name *", width: 28 },
  { key: "office", header: "Office *", width: 24 },
  { key: "joiningDate", header: "Joining Date (YYYY-MM-DD) *", width: 24 },
  { key: "designation", header: "Designation", width: 20 },
  { key: "hrPosition", header: "HR Position", width: 18 },
  { key: "department", header: "Department", width: 20 },
  { key: "departmentSection", header: "Department Section", width: 20 },
  { key: "employeeType", header: "Employee Type", width: 16 },
  { key: "serviceCategory", header: "Service Category", width: 18 },
  { key: "employeePolicy", header: "Employee Policy", width: 18 },
  { key: "location", header: "Location", width: 18 },
  { key: "confirmationDate", header: "Confirmation Date", width: 18 },
  { key: "mobile", header: "Mobile", width: 16 },
  { key: "email", header: "Email", width: 26 },
  { key: "officialContact", header: "Official Contact", width: 16 },
  { key: "gender", header: "Gender", width: 10 },
  { key: "religion", header: "Religion", width: 12 },
  { key: "bloodGroup", header: "Blood Group", width: 12 },
  { key: "dateOfBirth", header: "Date of Birth", width: 14 },
  { key: "fathersName", header: "Father's Name", width: 22 },
  { key: "mothersName", header: "Mother's Name", width: 22 },
  { key: "nidNumber", header: "NID Number", width: 18 },
  { key: "presentAddress", header: "Present Address", width: 32 },
  { key: "permanentAddress", header: "Permanent Address", width: 32 },
  { key: "supervisor", header: "Supervisor", width: 20 },
  { key: "lineManager", header: "Line Manager", width: 20 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
const DATE_KEYS = ["joiningDate", "confirmationDate", "dateOfBirth"] as const;
const key = (value: string) => value.trim().toLowerCase();
/** Header text compared loosely: ignores case, "*", bracketed hints, extra/non-breaking spaces and invisible characters. */
const headerKey = (header: string) =>
  header
    .replace(/[\u200b\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Other names for a column, so an Employee List export can be re-uploaded without renaming headers. */
const HEADER_ALIASES: Partial<Record<ColumnKey, string[]>> = {
  employeeCode: ["employee code"],
  name: ["name"],
  office: ["office name"],
  joiningDate: ["joining date"],
  mobile: ["mobile no", "mobile number"],
  officialContact: ["official contact no"],
};

function columnFor(headerText: string) {
  const wanted = headerKey(headerText);
  return COLUMNS.find((c) => headerKey(c.header) === wanted || HEADER_ALIASES[c.key]?.includes(wanted));
}

/** How many top rows are searched for the header row (people sometimes add a title above it). */
const HEADER_SEARCH_ROWS = 10;

/** YYYY-MM-DD from "2026-03-15", "15/03/2026" or "15-03-2026" (Excel dates arrive as YYYY-MM-DD). */
function isoDate(raw: string, header: string): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  throw new Error(`${header}: use YYYY-MM-DD (or DD/MM/YYYY).`);
}

async function officesFor(actor: Actor) {
  return db().office.findMany({
    where: actor.companyScope === "ALL" ? {} : { businessUnit: { companyId: { in: [...actor.companyScope] } } },
    select: { id: true, name: true, businessUnitId: true },
    orderBy: { name: "asc" },
  });
}

export async function employeeImportTemplate(actor: Actor): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF1E3A8A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };

  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 110 }];
  [
    "One row per employee on the Employees sheet. Columns marked * are required.",
    "Office must match an office name exactly (case does not matter); the Offices sheet lists them.",
    "Employee ID must be new within the office's business unit. Rows with an existing ID are skipped.",
    "Dates: YYYY-MM-DD (e.g. 2026-03-15) or DD/MM/YYYY.",
    "Salary, academic records, documents and ERP access are added from each employee's profile after upload.",
  ].forEach((line) => help.addRow([line]));

  const officeSheet = workbook.addWorksheet("Offices");
  officeSheet.columns = [{ header: "Office", key: "name", width: 40 }];
  officeSheet.getRow(1).font = { bold: true };
  for (const office of await officesFor(actor)) officeSheet.addRow({ name: office.name });

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function importEmployees(actor: Actor, bytes: Uint8Array): Promise<EmployeeImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.getWorksheet("Employees") ?? workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");

  // Columns are matched by header text, so re-ordered sheets still work.
  const readHeaders = (rowNumber: number) => {
    const found = new Map<ColumnKey, number>();
    sheet.getRow(rowNumber).eachCell((cell, column) => {
      const match = columnFor(cellText(cell.value));
      if (match && !found.has(match.key)) found.set(match.key, column);
    });
    return found;
  };
  // The header row is the first of the top rows that has the Employee ID column.
  let headerRow = 1;
  for (let r = 1; r <= Math.min(HEADER_SEARCH_ROWS, Math.max(sheet.rowCount, 1)); r++) {
    if (readHeaders(r).has("employeeCode")) {
      headerRow = r;
      break;
    }
  }
  const index = readHeaders(headerRow);
  const missing = COLUMNS.filter((c) => c.header.includes("*") && !index.has(c.key));
  if (missing.length > 0) {
    const seen: string[] = [];
    sheet.getRow(headerRow).eachCell((cell) => {
      const text = cellText(cell.value);
      if (text) seen.push(text);
    });
    const names = missing.map((c) => `"${c.header}"`).join(", ");
    const found = seen.length > 0 ? ` Found on "${sheet.name}": ${seen.slice(0, 8).join(", ")}${seen.length > 8 ? ", …" : ""}.` : ` Sheet "${sheet.name}" has no header row.`;
    throw new AppError(400, "VALIDATION_ERROR", `Column ${names} ${missing.length > 1 ? "are" : "is"} missing. Use the template.${found}`);
  }

  const rows: { row: number; get: (k: ColumnKey) => string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const get = (k: ColumnKey) => {
      const column = index.get(k);
      return column ? cellText(row.getCell(column).value) : "";
    };
    if (COLUMNS.every((c) => get(c.key) === "")) return; // blank line
    rows.push({ row: rowNumber, get });
  });
  if (rows.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The sheet has no employee rows.");
  if (rows.length > MAX_EMPLOYEE_IMPORT_ROWS) throw new AppError(400, "VALIDATION_ERROR", `Upload at most ${MAX_EMPLOYEE_IMPORT_ROWS} employees per file.`);

  const offices = await officesFor(actor);
  const officeByName = new Map(offices.map((o) => [key(o.name), o]));
  // Employee IDs already used, per business unit (plus those added from this file).
  const existing = await db().employee.findMany({ where: { officeId: { in: offices.map((o) => o.id) } }, select: { employeeCode: true, office: { select: { businessUnitId: true } } } });
  const taken = new Set(existing.map((e) => `${e.office.businessUnitId}|${key(e.employeeCode)}`));

  const result: EmployeeImportResult = { created: 0, errors: [] };
  for (const { row, get } of rows) {
    try {
      const office = officeByName.get(key(get("office")));
      if (!office) throw new Error(get("office") ? `Office "${get("office")}" not found.` : "Office is required.");
      const codeKey = `${office.businessUnitId}|${key(get("employeeCode"))}`;
      if (get("employeeCode") && taken.has(codeKey)) throw new Error(`Employee ID "${get("employeeCode")}" already exists.`);

      const dates = Object.fromEntries(DATE_KEYS.map((k) => [k, isoDate(get(k), COLUMNS.find((c) => c.key === k)!.header.replace(/\s*\*?\s*\(YYYY-MM-DD\)\s*\*?$/, ""))]));
      const text = (k: ColumnKey) => get(k) || undefined;
      const input: CreateEmployeeInput = createEmployeeSchema.parse({
        employeeCode: get("employeeCode"),
        attendanceId: text("attendanceId"),
        name: get("name"),
        officeId: office.id,
        designation: text("designation"),
        hrPosition: text("hrPosition"),
        department: text("department"),
        departmentSection: text("departmentSection"),
        employeeType: text("employeeType"),
        serviceCategory: text("serviceCategory"),
        employeePolicy: text("employeePolicy"),
        location: text("location"),
        joiningDate: dates.joiningDate,
        confirmationDate: dates.confirmationDate,
        dateOfBirth: dates.dateOfBirth,
        mobile: text("mobile"),
        email: get("email"),
        officialContact: text("officialContact"),
        gender: text("gender"),
        religion: text("religion"),
        bloodGroup: text("bloodGroup"),
        fathersName: text("fathersName"),
        mothersName: text("mothersName"),
        nidNumber: text("nidNumber"),
        presentAddress: text("presentAddress"),
        permanentAddress: text("permanentAddress"),
        supervisor: text("supervisor"),
        lineManager: text("lineManager"),
      });
      await createEmployee(actor, input);
      taken.add(codeKey);
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
