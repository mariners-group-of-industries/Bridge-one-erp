import ExcelJS from "exceljs";
import { cellText, describe, parseFlag } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { AppError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import {
  CUSTOMER_FLAGS,
  GENDERS,
  MARITAL_STATUSES,
  MAX_CUSTOMER_IMPORT_ROWS,
  type CustomerFlag,
  type CustomerImportResult,
  type CustomerInput,
} from "../schemas/customer.schema";
import { createCustomer, getFormOptions } from "./customer.service";

/**
 * Bulk upload of customers from Excel. One row per customer; dropdown fields are
 * matched by name (sales representative by code or name). Shipping details are
 * added in the form afterwards.
 */

const COLUMNS = [
  { key: "code", header: "Partner Code", width: 14 },
  { key: "name", header: "Partner Name *", width: 30 },
  { key: "office", header: "Office *", width: 22 },
  { key: "mobile", header: "Mobile Number *", width: 16 },
  { key: "email", header: "Email", width: 24 },
  { key: "group", header: "Partner Group", width: 18 },
  { key: "subGroup", header: "Sub Group", width: 18 },
  { key: "creditDays", header: "Credit Days", width: 12 },
  { key: "creditLimit", header: "Credit Limit", width: 14 },
  { key: "territory", header: "Territory", width: 16 },
  { key: "salesPerson", header: "Default Sales Representative", width: 26 },
  { key: "tolerancePercent", header: "Tolerance %", width: 12 },
  { key: "binNumber", header: "BIN Number", width: 16 },
  { key: "priceType", header: "Price Type", width: 16 },
  { key: "tcsPercent", header: "TCS %", width: 10 },
  { key: "vatRegistrationNo", header: "VAT Reg No (Central)", width: 20 },
  { key: "tinNumber", header: "TIN Number", width: 16 },
  { key: "tradeLicenseNo", header: "Trade License Number", width: 20 },
  { key: "maritalStatus", header: "Marital Status", width: 14 },
  { key: "marriageDate", header: "Marriage Date (YYYY-MM-DD)", width: 22 },
  { key: "birthDate", header: "Birth Date (YYYY-MM-DD)", width: 20 },
  { key: "gender", header: "Gender", width: 10 },
  { key: "nidNumber", header: "NID Number", width: 18 },
  ...CUSTOMER_FLAGS.map((flag) => ({ key: flag.key, header: flag.label, width: Math.max(10, flag.label.length + 2) })),
  { key: "billingAddress", header: "Billing Address", width: 34 },
  { key: "district", header: "District", width: 16 },
  { key: "thana", header: "Thana", width: 16 },
  { key: "contactPerson", header: "Contact Person", width: 20 },
  { key: "contactNo", header: "Contact No", width: 16 },
  { key: "taxBracket", header: "Tax Bracket", width: 16 },
  { key: "remarks", header: "Remarks / Notes", width: 30 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
const normal = (value: string) => value.trim().toLowerCase().replace(/\s*\*$/, "");

export async function customerImportTemplate(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Customers", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((column) => ({ ...column }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF1E3A8A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };

  const help = workbook.addWorksheet("Instructions");
  help.columns = [{ width: 110 }];
  [
    "One row per customer on the Customers sheet. Columns marked * are required.",
    "Office, Partner Group, Sub Group, Territory, Price Type, District, Thana and Tax Bracket must match existing names (case does not matter).",
    "Default Sales Representative: the representative's code or name.",
    "Leave Partner Code empty to have a code generated (CUST-00001 …).",
    `Marital Status: ${MARITAL_STATUSES.join(", ")}. Gender: ${GENDERS.join(", ")}. Dates as YYYY-MM-DD.`,
    "Yes/No columns accept Yes, No, Y, N, True, False, 1 or 0; empty means No.",
    "Shipping details (outlets) are added in the form after upload.",
  ].forEach((line) => help.addRow([line]));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function importCustomers(actor: Actor, bytes: Uint8Array): Promise<CustomerImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "The file is not a valid Excel (.xlsx) workbook.");
  }
  const sheet = workbook.getWorksheet("Customers") ?? workbook.worksheets[0];
  if (!sheet) throw new AppError(400, "VALIDATION_ERROR", "The workbook has no sheets.");

  const headerIndex = new Map<ColumnKey, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const match = COLUMNS.find((c) => normal(c.header) === normal(cellText(cell.value)));
    if (match) headerIndex.set(match.key, column);
  });
  for (const required of ["name", "office", "mobile"] as const) {
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
    if (COLUMNS.every((c) => get(c.key) === "")) return;
    rows.push({ row: rowNumber, get });
  });
  if (rows.length === 0) throw new AppError(400, "VALIDATION_ERROR", "The sheet has no customer rows.");
  if (rows.length > MAX_CUSTOMER_IMPORT_ROWS) {
    throw new AppError(400, "VALIDATION_ERROR", `Upload at most ${MAX_CUSTOMER_IMPORT_ROWS} customers per file.`);
  }

  const options = await getFormOptions(actor);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const result: CustomerImportResult = { created: 0, errors: [] };

  for (const { row, get } of rows) {
    try {
      const office = options.offices.find((o) => same(o.name, get("office")));
      if (!office) throw new Error(get("office") ? `Office "${get("office")}" not found.` : "Office is required.");
      const unit = office.businessUnitId;

      const find = <T extends { name: string }>(list: T[], label: string, value: string, extra: (item: T) => boolean) => {
        if (!value) return undefined;
        const found = list.find((item) => same(item.name, value) && extra(item));
        if (!found) throw new Error(`${label} "${value}" not found.`);
        return found;
      };
      const group = find(options.groups, "Partner Group", get("group"), (g) => !g.parentId && g.businessUnitId === unit);
      if (get("subGroup") && !group) throw new Error("Sub Group needs a Partner Group.");
      const subGroup = find(options.groups, "Sub Group", get("subGroup"), (g) => g.parentId === group?.id);
      const territory = find(options.territories, "Territory", get("territory"), (t) => t.businessUnitId === unit);
      const priceList = find(options.priceLists, "Price Type", get("priceType"), (p) => p.businessUnitId === unit);
      const taxBracket = find(options.taxBrackets, "Tax Bracket", get("taxBracket"), (t) => t.businessUnitId === unit);
      const district = find(options.districts, "District", get("district"), () => true);
      const thana = find(options.thanas, "Thana", get("thana"), (t) => t.districtId === district?.id);
      let salesPersonId = "";
      if (get("salesPerson")) {
        const rep = options.salesPersons.find(
          (p) => p.businessUnitId === unit && (same(p.code, get("salesPerson")) || same(p.name, get("salesPerson"))),
        );
        if (!rep) throw new Error(`Sales representative "${get("salesPerson")}" not found.`);
        salesPersonId = rep.id;
      }

      const pickFrom = <T extends string>(list: readonly T[], label: string, value: string): T | "" => {
        if (!value) return "";
        const found = list.find((item) => same(item, value));
        if (!found) throw new Error(`${label}: use ${list.join(", ")}.`);
        return found;
      };

      const flags = Object.fromEntries(
        CUSTOMER_FLAGS.map((flag) => [flag.key, parseFlag(get(flag.key), flag.label)]),
      ) as Record<CustomerFlag, boolean>;

      const input: CustomerInput = {
        officeId: office.id,
        name: get("name"),
        code: get("code"),
        mobile: get("mobile"),
        email: get("email"),
        groupId: group?.id ?? "",
        subGroupId: subGroup?.id ?? "",
        creditDays: get("creditDays"),
        creditLimit: get("creditLimit"),
        territoryId: territory?.id ?? "",
        salesPersonId,
        tolerancePercent: get("tolerancePercent"),
        binNumber: get("binNumber"),
        priceListId: priceList?.id ?? "",
        tcsPercent: get("tcsPercent"),
        vatRegistrationNo: get("vatRegistrationNo"),
        tinNumber: get("tinNumber"),
        tradeLicenseNo: get("tradeLicenseNo"),
        maritalStatus: pickFrom(MARITAL_STATUSES, "Marital Status", get("maritalStatus")),
        marriageDate: get("marriageDate"),
        birthDate: get("birthDate"),
        gender: pickFrom(GENDERS, "Gender", get("gender")),
        nidNumber: get("nidNumber"),
        ...flags,
        billingAddress: get("billingAddress"),
        districtId: district?.id ?? "",
        thanaId: thana?.id ?? "",
        contactPerson: get("contactPerson"),
        contactNo: get("contactNo"),
        taxBracketId: taxBracket?.id ?? "",
        remarks: get("remarks"),
        shipping: [],
      };
      await createCustomer(actor, input);
      result.created += 1;
    } catch (error) {
      result.errors.push({ row, message: describe(error) });
    }
  }
  return result;
}
