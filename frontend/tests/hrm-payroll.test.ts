import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createBonus, createIncrement, decideBonus, decideIncrement, listBonusAdvice, listIncrements } from "@/features/hrm/compensation/server/compensation.service";
import { decidePending, pendingApprovals, policyGrid } from "@/features/hrm/governance/server/governance.service";
import { listPayroll, processPayroll, salarySheet, unprocessPayroll } from "@/features/hrm/payroll/server/payroll.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let officeId: string;
const ids: Record<string, string> = {};
const employee = adminActor;
const staff = { ...adminActor, id: "test-staff", isMaster: false };

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
  const add = async (code: string, joiningDate: string, gross: number | null, extra: Record<string, unknown> = {}) => {
    const { id } = await testPrisma().employee.create({ data: { officeId, employeeCode: code, name: `Employee ${code}`, joiningDate: new Date(joiningDate), ...extra } });
    if (gross !== null) await testPrisma().employeeSalary.create({ data: { employeeId: id, salaryType: "regular", salaryOption: "gross", grossOnly: gross, disbursementMode: "bank", bankName: "City Bank", bankAccountNo: `AC-${code}` } });
    ids[code] = id;
  };
  await add("E-1", "2020-01-01", 30000);
  await add("E-2", "2026-09-16", 30000); // joined half way through September
  await add("E-3", "2020-01-01", null); // no salary
  await add("E-4", "2020-01-01", 20000, { holdSalary: true });
  await testPrisma().employeeSalaryAdjustment.createMany({
    data: [
      { employeeId: ids["E-1"], fromMonth: "2026-09", toMonth: "2026-12", type: "addition", amount: 1000 },
      { employeeId: ids["E-1"], fromMonth: "2026-09", toMonth: "2026-09", type: "deduction", amount: 500 },
    ],
  });
});

describe("Payroll", () => {
  it("prorates joiners, applies the month's adjustments, holds held salaries and skips employees without a salary", async () => {
    const sheet = await salarySheet(adminActor, officeId, "2026-09");
    expect(sheet.status).toBe("Not Processed");
    expect(sheet.withoutSalary).toBe(1);
    expect(sheet.lines.map((l) => [l.employeeCode, l.payableDays, l.earnedSalary, l.netAmount, l.disbursementMode])).toEqual([
      ["E-1", 30, 30000, 30500, "bank"],
      ["E-2", 15, 15000, 15000, "bank"],
      ["E-4", 30, 20000, 0, "hold"],
    ]);
    expect(sheet.lines[0]).toMatchObject({ bankOrProvider: "City Bank", accountNo: "AC-E-1" });
    expect(sheet.totals.netAmount).toBe(45500);
    // Before E-2 joined: only E-1 and E-4; October has no deduction.
    expect((await salarySheet(adminActor, officeId, "2026-08")).lines.map((l) => l.employeeCode)).toEqual(["E-1", "E-4"]);
    expect((await salarySheet(adminActor, officeId, "2026-10")).totals.netAmount).toBe(61000);
  });

  it("locks the figures when processed, and calculates live again when undone", async () => {
    expect(await listPayroll(adminActor, { month: "2026-09" })).toEqual([expect.objectContaining({ officeId, employeeCount: 3, netAmount: 45500, status: "Not Processed", runId: null })]);
    const { id } = await processPayroll(adminActor, officeId, "2026-09");
    await expect(processPayroll(adminActor, officeId, "2026-09")).rejects.toThrow(/already been processed/);

    await testPrisma().employeeSalary.update({ where: { employeeId: ids["E-1"] }, data: { grossOnly: 90000 } });
    expect((await listPayroll(adminActor, { month: "2026-09", officeId }))[0]).toMatchObject({ status: "Processed", netAmount: 45500, runId: id });
    expect((await salarySheet(adminActor, officeId, "2026-09")).lines[0].grossSalary).toBe(30000);

    await unprocessPayroll(adminActor, id);
    expect((await salarySheet(adminActor, officeId, "2026-09")).lines[0].grossSalary).toBe(90000);
  });

  it("is for HR only", async () => {
    await expect(listPayroll(staff, { month: "2026-09" })).rejects.toThrow(/Only HR/);
    await expect(salarySheet(staff, officeId, "2026-09")).rejects.toThrow(/Only HR/);
  });
});

describe("Bonus and increment", () => {
  it("gives the bonus to employees with a salary and enough service, payable once approved", async () => {
    const { id, employeeCount } = await createBonus(employee, { name: "Eid Bonus", bonusDate: "2026-10-01", percentOfGross: 50, minServiceMonths: 6 });
    // E-2 has only 0 months, E-3 no salary, E-4 has the salary on hold.
    expect(employeeCount).toBe(1);
    expect(await listBonusAdvice(adminActor, "Pending")).toEqual([expect.objectContaining({ employeeCode: "E-1", amount: 15000, serviceMonths: 81 })]);
    await decideBonus(adminActor, id, "Approved");
    expect(await listBonusAdvice(adminActor, "Pending")).toEqual([]);
    expect((await listBonusAdvice(adminActor, "Approved")).length).toBe(1);
  });

  it("raises the salary when an increment is approved, and goes through Pending Approval", async () => {
    await createIncrement(adminActor, { employeeId: ids["E-1"], effectiveDate: "2026-11-01", incrementType: "Percent", value: 10 });
    await expect(createIncrement(adminActor, { employeeId: ids["E-1"], effectiveDate: "2026-12-01", incrementType: "Amount", value: 500 })).rejects.toThrow(/already has a pending/);
    await expect(createIncrement(adminActor, { employeeId: ids["E-3"], effectiveDate: "2026-11-01", incrementType: "Amount", value: 500 })).rejects.toThrow(/no salary/);

    const pending = await pendingApprovals(adminActor, "increment");
    expect(pending.rows).toEqual([expect.objectContaining({ previous: "30000.00", next: "33000.00" })]);
    await decidePending(adminActor, "increment", pending.rows[0].id, "Approved");
    expect(Number((await testPrisma().employeeSalary.findUniqueOrThrow({ where: { employeeId: ids["E-1"] } })).grossOnly)).toBe(33000);
    expect((await listIncrements(adminActor, { status: "Approved", fromDate: "2026-11-01", toDate: "2026-11-30" })).length).toBe(1);
    await expect(decideIncrement(adminActor, pending.rows[0].id, "Rejected")).rejects.toThrow(/already been decided/);
    expect((await pendingApprovals(adminActor, "increment")).rows).toEqual([]);
  });
});

describe("Settings / Policies", () => {
  it("shows stored data for a tab, narrowed by the filters, and says when a setting is not stored", async () => {
    const salary = await policyGrid(adminActor, "salary", { employeeId: ids["E-1"] });
    expect(salary.rows).toEqual([expect.objectContaining({ code: "E-1", gross: 30000, mode: "bank" })]);
    expect((await policyGrid(adminActor, "allowance", { fromDate: "2026-10-01", toDate: "2026-10-31" })).rows).toEqual([expect.objectContaining({ code: "E-1", type: "Addition" })]);
    expect(await policyGrid(adminActor, "holidays", {})).toMatchObject({ configured: false, rows: [] });
    await expect(policyGrid(staff, "salary", {})).rejects.toThrow(/Only HR/);
  });
});
