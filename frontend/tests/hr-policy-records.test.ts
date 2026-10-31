import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createPolicyRecord, deletePolicyRecord, importCalendarInfo, listPolicyRecords, refOptions, updatePolicyRecord } from "@/features/hrm/governance/server/policy-records.service";
import { POLICY_TAB_DEFS } from "@/features/hrm/governance/policy-fields";
import { employeeChecklist, policyGrid, setChecklistFlag } from "@/features/hrm/governance/server/governance.service";
import { POLICY_TABS } from "@/features/hrm/governance/types";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let officeId: string;
let employeeId: string;
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
  employeeId = (await testPrisma().employee.create({ data: { officeId, employeeCode: "E-1", name: "Rahim", joiningDate: new Date("2024-01-01") } })).id;
});

describe("Settings / Policies records", () => {
  it("defines fields for every tab", () => {
    expect(POLICY_TABS.every((t) => POLICY_TAB_DEFS[t.id].fields.length > 0)).toBe(true);
  });

  it("stores holiday groups with their days, checks the days are in the year, and filters by office", async () => {
    await expect(createPolicyRecord(adminActor, "holidays", { data: { name: "", year: 2026 } })).rejects.toThrow();
    await expect(createPolicyRecord(adminActor, "holidays", { data: { name: "Govt 2026", year: 26 } })).rejects.toThrow(/less than 2000/);
    await expect(
      createPolicyRecord(adminActor, "holidays", { data: { name: "Govt 2026", year: 2026, holidays: [{ date: "2027-01-01", title: "New Year", holidayType: "Public" }] } }),
    ).rejects.toThrow(/not in 2026/);

    const all = await createPolicyRecord(adminActor, "holidays", {
      data: { name: "Govt 2026", year: "2026", extra: "dropped", holidays: [{ date: "2026-12-16", title: "Victory Day", holidayType: "Public" }] },
    });
    expect(all).toMatchObject({ officeName: null, data: { name: "Govt 2026", year: 2026, holidays: [{ date: "2026-12-16", title: "Victory Day", holidayType: "Public" }] } });
    expect(all.data).not.toHaveProperty("extra");
    const other = await createPolicyRecord(adminActor, "holidays", { officeId, data: { name: "Factory 2026", year: 2026 } });
    expect((await listPolicyRecords(adminActor, "holidays", { officeId })).length).toBe(2);
    expect(await refOptions(adminActor, "holidays")).toEqual(["Factory 2026", "Govt 2026"]);

    await updatePolicyRecord(adminActor, all.id, { data: { name: "Government Holidays 2026", year: 2026 } });
    expect((await listPolicyRecords(adminActor, "holidays")).map((r) => r.data.name).sort()).toEqual(["Factory 2026", "Government Holidays 2026"]);
    await deletePolicyRecord(adminActor, other.id);
    expect((await listPolicyRecords(adminActor, "holidays")).length).toBe(1);
  });

  it("filters dated records by the From / To range", async () => {
    await createPolicyRecord(adminActor, "off-day", { effectiveFrom: "2026-01-01", data: { days: ["Friday"] } });
    await createPolicyRecord(adminActor, "notice-board", { effectiveFrom: "2026-12-01", effectiveTo: "2026-12-31", data: { name: "Year end", priority: "Normal", message: "Closing." } });
    await expect(createPolicyRecord(adminActor, "notice-board", { effectiveFrom: "2026-12-31", effectiveTo: "2026-12-01", data: { name: "x", priority: "Normal", message: "x" } })).rejects.toThrow(/cannot be before/);
    expect((await listPolicyRecords(adminActor, "notice-board", { fromDate: "2026-11-01", toDate: "2026-11-30" })).length).toBe(0);
    expect((await listPolicyRecords(adminActor, "notice-board", { fromDate: "2026-12-15" })).length).toBe(1);
    expect((await listPolicyRecords(adminActor, "off-day", { toDate: "2025-12-31" })).length).toBe(0);
  });

  it("imports Calendar Info into Calendar Setup once, and checks break times and salary totals", async () => {
    await testPrisma().office.update({ where: { id: officeId }, data: { name: "MG Sirajganj Factory" } });
    const first = await importCalendarInfo(adminActor);
    expect(first.created).toBeGreaterThan(0);
    expect((await listPolicyRecords(adminActor, "calendar-setup")).every((c) => c.officeName === "MG Sirajganj Factory")).toBe(true);
    // Only offices that exist (by name) and "All" are imported; a second run adds nothing.
    expect((await importCalendarInfo(adminActor)).created).toBe(0);
    const calendars = await listPolicyRecords(adminActor, "calendar-setup");
    expect(calendars.length).toBe(first.created);
    expect(calendars.every((c) => /^\d{2}:\d{2}$/.test(String(c.data.startTime)))).toBe(true);

    await expect(createPolicyRecord(adminActor, "calendar-setup", { data: { name: "X", shortCode: "X", startTime: "09:00", endTime: "17:00", minWorkHours: 8, breakStartTime: "13:00" } })).rejects.toThrow(/both Break/);
    await expect(createPolicyRecord(adminActor, "salary", { effectiveFrom: "2026-01-01", data: { name: "S", basicPercent: 60, houseRentPercent: 50 } })).rejects.toThrow(/110%/);
  });

  it("checks required employees, weekdays, percentages and references to other tabs", async () => {
    await expect(createPolicyRecord(adminActor, "roster", { effectiveFrom: "2026-11-01", data: { calendar: "Morning", pattern: "Fixed" } })).rejects.toThrow(/Employee is required/);
    await expect(createPolicyRecord(adminActor, "roster", { employeeId, effectiveFrom: "2026-11-01", data: { calendar: "Morning", pattern: "Fixed" } })).rejects.toThrow(/does not exist/);
    await expect(createPolicyRecord(adminActor, "calendar-setup", { data: { name: "Morning", startTime: "09:00", endTime: "18:00", minWorkHours: 8 } })).rejects.toThrow(/Short Code is required/);
    await createPolicyRecord(adminActor, "calendar-setup", { data: { name: "Morning", shortCode: "M", startTime: "09:00", endTime: "18:00", minWorkHours: 8 } });
    expect(await refOptions(adminActor, "calendar-setup")).toEqual(["Morning"]);
    const roster = await createPolicyRecord(adminActor, "roster", { employeeId, effectiveFrom: "2026-11-01", data: { calendar: "Morning", pattern: "Fixed" } });
    expect(roster.employeeLabel).toBe("E-1 — Rahim");

    await expect(createPolicyRecord(adminActor, "off-day", { effectiveFrom: "2026-11-01", data: { days: [] } })).rejects.toThrow();
    expect((await createPolicyRecord(adminActor, "off-day", { effectiveFrom: "2026-11-01", data: { days: ["Friday"] } })).data.days).toEqual(["Friday"]);
    await expect(createPolicyRecord(adminActor, "pf-setup", { effectiveFrom: "2026-01-01", data: { basis: "Basic", employeePercent: 150, employerPercent: 10 } })).rejects.toThrow(/more than 100/);
    expect((await createPolicyRecord(adminActor, "pf-setup", { effectiveFrom: "2026-01-01", data: { basis: "Basic", employeePercent: "10", employerPercent: 10 } })).data).toMatchObject({ employeePercent: 10, eligibleAfterMonths: null });
  });

  it("is for HR only", async () => {
    await expect(listPolicyRecords(staff, "holidays")).rejects.toThrow(/Only HR/);
  });
});

describe("Employee Assign checklist", () => {
  it("lists employees with service length, assigned policy and OverTime / PF / Hold Salary, and saves ticks", async () => {
    await testPrisma().employee.update({ where: { id: employeeId }, data: { designation: "Officer", department: "HR", employeePolicy: "Profile Policy" } });
    const second = await testPrisma().employee.create({ data: { officeId, employeeCode: "E-2", name: "Karim", joiningDate: new Date("2026-10-01"), employeePolicy: "Profile Policy" } });
    await testPrisma().employeeSalary.create({ data: { employeeId, salaryType: "regular", salaryOption: "gross", grossOnly: 30000, disbursementMode: "cash" } });
    await testPrisma().hrPolicyRecord.createMany({
      data: [
        { tab: "employee-assign", employeeId, effectiveFrom: new Date("2026-01-01"), data: { calendar: "General", policy: "Head Office Policy" } },
        { tab: "employee-assign", employeeId, effectiveFrom: new Date("2025-01-01"), effectiveTo: new Date("2025-12-31"), data: { calendar: "General", policy: "Old Policy" } },
      ],
    });

    const today = new Date("2026-10-31T00:00:00Z");
    const rows = await employeeChecklist(adminActor, {}, today);
    expect(rows.map((r) => [r.code, r.policy, r.serviceDays, r.hasSalary, r.overtime, r.pf, r.holdSalary])).toEqual([
      ["E-1", "Head Office Policy", 1034, true, false, false, false],
      ["E-2", "Profile Policy", 30, false, false, false, false],
    ]);

    await setChecklistFlag(adminActor, employeeId, "overtime", true);
    await setChecklistFlag(adminActor, employeeId, "pf", true);
    await setChecklistFlag(adminActor, second.id, "holdSalary", true);
    // PF lives on the salary, which Karim does not have yet.
    await expect(setChecklistFlag(adminActor, second.id, "pf", true)).rejects.toThrow(/salary/);
    expect((await employeeChecklist(adminActor, {}, today)).map((r) => [r.overtime, r.pf, r.holdSalary])).toEqual([
      [true, true, false],
      [false, false, true],
    ]);

    // Employee Assign no longer shows the "From employee records" grid.
    expect((await policyGrid(adminActor, "employee-assign", {})).configured).toBe(false);
    await expect(employeeChecklist(staff, {})).rejects.toThrow(/Only HR/);
  });
});
