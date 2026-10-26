import ExcelJS from "exceljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { employeeImportTemplate, importEmployees } from "@/features/configuration/entity-master-data/employee/server/employee-excel";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let officeId: string;

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await resetTestDb();
  await saveCompany(adminActor, companyInput);
  const unitId = (await createBusinessUnit(adminActor, businessUnitInput)).id;
  officeId = (await createOffice(adminActor, unitId, officeInput)).id;
  await testPrisma().employee.create({ data: { officeId, employeeCode: "E-OLD", name: "Existing", joiningDate: new Date("2024-01-01") } });
});

async function workbook(rows: (string | Date)[][]) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await employeeImportTemplate(adminActor)) as unknown as ArrayBuffer);
  const sheet = book.getWorksheet("Employees")!;
  for (const row of rows) sheet.addRow(row);
  return new Uint8Array(await book.xlsx.writeBuffer());
}

describe("employee bulk upload", () => {
  it("offers a template with the required columns and the office list", async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await employeeImportTemplate(adminActor)) as unknown as ArrayBuffer);
    const headers = (book.getWorksheet("Employees")!.getRow(1).values as string[]).filter(Boolean);
    expect(headers.slice(0, 5)).toEqual(["Employee ID *", "Attendance ID", "Employee Name *", "Office *", "Joining Date (YYYY-MM-DD) *"]);
    expect(book.getWorksheet("Offices")!.getRow(2).getCell(1).value).toBe(officeInput.name);
  });

  it("creates valid rows and reports the rest by row number", async () => {
    const office = officeInput.name.toUpperCase(); // office names match case-insensitively
    const bytes = await workbook([
      ["E-1", "A-1", "Rahim Uddin", office, "2026-03-15", "SR", "", "Sales"],
      ["E-2", "", "Karim", office, new Date("2026-04-01T00:00:00Z"), "Officer"],
      ["E-3", "", "Salma", office, "15/05/2026"],
      ["E-OLD", "", "Duplicate", office, "2026-01-01"],
      ["E-1", "", "Same ID twice", office, "2026-01-01"],
      ["E-4", "", "No Office", "Nowhere", "2026-01-01"],
      ["E-5", "", "Bad Date", office, "March 2026"],
      ["", "", "No ID", office, "2026-01-01"],
    ]);
    const result = await importEmployees(adminActor, bytes);
    expect(result.created).toBe(3);
    expect(result.errors.map((e) => e.row)).toEqual([5, 6, 7, 8, 9]);
    expect(result.errors[0].message).toContain('"E-OLD" already exists');
    expect(result.errors[2].message).toContain('Office "Nowhere" not found');

    const saved = await testPrisma().employee.findMany({ where: { employeeCode: { in: ["E-1", "E-2", "E-3"] } }, orderBy: { employeeCode: "asc" } });
    expect(saved.map((e) => [e.employeeCode, e.name, e.joiningDate.toISOString().slice(0, 10), e.designation])).toEqual([
      ["E-1", "Rahim Uddin", "2026-03-15", "SR"],
      ["E-2", "Karim", "2026-04-01", "Officer"],
      ["E-3", "Salma", "2026-05-15", null],
    ]);
    expect(saved[0].department).toBe("Sales");
  });

  it("rejects files that are not the template", async () => {
    await expect(importEmployees(adminActor, new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(AppError);
    const book = new ExcelJS.Workbook();
    book.addWorksheet("Employees").addRow(["Name"]);
    await expect(importEmployees(adminActor, new Uint8Array(await book.xlsx.writeBuffer()))).rejects.toThrow(/missing/);
  });

  it("names the headers it found when the required column is missing", async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet("Employees").addRow(["Code", "Name"]);
    await expect(importEmployees(adminActor, new Uint8Array(await book.xlsx.writeBuffer()))).rejects.toThrow(/Found on "Employees": Code, Name/);
  });

  it("accepts an Employee List export's column names", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Employee List");
    sheet.addRow(["Employee Id", "Attendance Id", "Employee Name", "Designation", "Department", "Office Name", "Joining Date", "Termination Date"]);
    sheet.addRow(["E-7", "", "Export Person", "Officer", "Sales", officeInput.name, "2026-02-01", ""]);
    const result = await importEmployees(adminActor, new Uint8Array(await book.xlsx.writeBuffer()));
    expect(result).toEqual({ created: 1, errors: [] });
  });

  it("tolerates a title row above the header and sloppy header text", async () => {
    const office = officeInput.name;
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Employees");
    sheet.addRow(["Employee upload"]);
    sheet.addRow(["employee  id*", "Employee Name *", "OFFICE *", "Joining Date (YYYY-MM-DD)*"]);
    sheet.addRow(["E-9", "Title Row Person", office, "2026-06-01"]);
    const result = await importEmployees(adminActor, new Uint8Array(await book.xlsx.writeBuffer()));
    expect(result).toEqual({ created: 1, errors: [] });
  });
});
