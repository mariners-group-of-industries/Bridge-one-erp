import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import {
  DEFAULT_OVERTIME_RULE,
  calculateOvertime,
  createEntries,
  decideEntries,
  deleteEntry,
  listEntries,
  overtimeOf,
  overtimeSummary,
} from "@/features/hrm/overtime/server/overtime.service";
import { formatMinutes, parseDuration } from "@/features/hrm/overtime/types";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let officeId: string;
let deviceId: string;
const ids: Record<string, string> = {};
/** A Dhaka (UTC+6) wall-clock time. */
const dhaka = (date: string, time: string) => new Date(`${date}T${time}:00+06:00`);

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
  deviceId = (await testPrisma().attendanceDevice.create({ data: { name: "Gate", ipAddress: "10.0.0.5", officeId } })).id;
  const add = async (code: string, eligibleOT: boolean, salary: { salaryOption: string } & Record<string, string | number>) => {
    const { id } = await testPrisma().employee.create({ data: { officeId, employeeCode: code, name: `Employee ${code}`, joiningDate: new Date("2020-01-01"), attendanceId: code } });
    await testPrisma().employeeSalary.create({ data: { employeeId: id, salaryType: "regular", disbursementMode: "cash", eligibleOT, ...salary } });
    ids[code] = id;
  };
  await add("E-1", true, { salaryOption: "structure-gross", structGross: 31200, sgGross: 31200, sgBasic: 20800 });
  await add("E-2", true, { salaryOption: "gross", grossOnly: 41600 }); // no basic
  await add("E-3", false, { salaryOption: "gross", grossOnly: 30000 });
  const punch = (code: string, at: Date) => testPrisma().attendancePunch.create({ data: { deviceId, deviceUserId: code, employeeId: ids[code], punchTime: at } });
  // Thursday 2026-10-01: E-1 works 9:00–19:30 (10.5 h → 2.5 h OT), E-2 9:00–17:20 (20 min OT), E-3 not eligible.
  await punch("E-1", dhaka("2026-10-01", "09:00"));
  await punch("E-1", dhaka("2026-10-01", "13:00"));
  await punch("E-1", dhaka("2026-10-01", "19:30"));
  await punch("E-2", dhaka("2026-10-01", "09:00"));
  await punch("E-2", dhaka("2026-10-01", "17:20"));
  await punch("E-3", dhaka("2026-10-01", "08:00"));
  await punch("E-3", dhaka("2026-10-01", "22:00"));
  // Friday 2026-10-02 (weekly off): every worked minute counts.
  await punch("E-1", dhaka("2026-10-02", "10:00"));
  await punch("E-1", dhaka("2026-10-02", "13:00"));
});

const expectAppError = async (promise: Promise<unknown>, status: number) => {
  const error = await promise.then(() => undefined, (reason: unknown) => reason);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
};

describe("overtime rule", () => {
  it("counts time beyond the standard day, all of a weekly off, and applies the minimum and daily maximum", () => {
    const rule = { ...DEFAULT_OVERTIME_RULE, minMinutes: 30, maxHoursPerDay: 2 };
    expect(overtimeOf(10 * 60, false, DEFAULT_OVERTIME_RULE)).toBe(120);
    expect(overtimeOf(8 * 60 + 20, false, rule)).toBe(0); // under the 30-minute minimum
    expect(overtimeOf(11 * 60, false, rule)).toBe(120); // capped at 2 hours
    expect(overtimeOf(3 * 60, true, DEFAULT_OVERTIME_RULE)).toBe(180);
  });

  it("formats and parses durations", () => {
    expect(formatMinutes(150)).toBe("2:30");
    expect(parseDuration("2:15")).toBe(135);
    expect(parseDuration("1.5")).toBe(90);
    expect(parseDuration("abc")).toBeNull();
  });
});

describe("Overtime", () => {
  it("calculates overtime from punches for eligible employees only", async () => {
    const result = await calculateOvertime(adminActor, { officeId, from: "2026-10-01", to: "2026-10-02" });
    expect(result.rule.configured).toBe(false);
    expect(result.notEligible).toBe(1);
    expect(result.days.map((d) => [d.date, d.employeeCode, d.inTime, d.outTime, d.workedMinutes, d.overtimeMinutes, d.offDay])).toEqual([
      ["2026-10-02", "E-1", "10:00", "13:00", 180, 180, true],
      ["2026-10-01", "E-1", "09:00", "19:30", 630, 150, false],
      ["2026-10-01", "E-2", "09:00", "17:20", 500, 20, false],
    ]);
  });

  it("follows the office's Overtime Setup rule", async () => {
    await testPrisma().hrPolicyRecord.create({
      data: { tab: "overtime-setup", officeId, effectiveFrom: new Date("2026-01-01"), data: { basis: "Gross", multiplier: "1.5", daysPerMonth: "26", hoursPerDay: "9", minMinutes: "30", maxHoursPerDay: "1" } },
    });
    const result = await calculateOvertime(adminActor, { officeId, from: "2026-10-01", to: "2026-10-01" });
    expect(result.rule).toMatchObject({ basis: "Gross", multiplier: 1.5, hoursPerDay: 9, minMinutes: 30, configured: true });
    // E-1: 10.5 h − 9 h = 90 min, capped at 60; E-2: under 9 h.
    expect(result.days.map((d) => [d.employeeCode, d.overtimeMinutes])).toEqual([
      ["E-1", 60],
      ["E-2", 0],
    ]);
  });

  it("submits, approves, and prices the month's overtime", async () => {
    await createEntries(adminActor, {
      entries: [
        { employeeId: ids["E-1"], date: "2026-10-01", minutes: 150, source: "Attendance", inTime: "09:00", outTime: "19:30", workedMinutes: 630 },
        { employeeId: ids["E-1"], date: "2026-10-02", minutes: 180, source: "Attendance" },
        { employeeId: ids["E-2"], date: "2026-10-05", minutes: 60, source: "Manual", reason: "Stock count" },
      ],
    });
    // The same day cannot be submitted twice; ineligible employees cannot claim overtime.
    await expectAppError(createEntries(adminActor, { entries: [{ employeeId: ids["E-1"], date: "2026-10-01", minutes: 30, source: "Manual" }] }), 409);
    await expectAppError(createEntries(adminActor, { entries: [{ employeeId: ids["E-3"], date: "2026-10-01", minutes: 30, source: "Manual" }] }), 400);

    const calculated = await calculateOvertime(adminActor, { officeId, from: "2026-10-01", to: "2026-10-01" });
    expect(calculated.days.find((d) => d.employeeCode === "E-1")?.entry).toMatchObject({ status: "Pending", minutes: 150 });

    const pending = await listEntries(adminActor, { officeId, from: "2026-10-01", to: "2026-10-31", status: "Pending" });
    expect(pending).toHaveLength(3);
    const e1 = pending.filter((r) => r.employeeCode === "E-1").map((r) => r.id);
    await decideEntries(adminActor, { ids: e1 }, "Approved");
    const e2 = pending.find((r) => r.employeeCode === "E-2")!;
    await decideEntries(adminActor, { ids: [e2.id] }, "Rejected");
    await expectAppError(decideEntries(adminActor, { ids: e1 }, "Rejected"), 409);
    await expectAppError(deleteEntry(adminActor, e1[0]), 400);

    // Default rule: 2 × basic ÷ 208. E-1 basic 20,800 → 100/h; 5.5 h × 100 × 2 = 1,100.
    const summary = await overtimeSummary(adminActor, { officeId, month: "2026-10" });
    expect(summary.pendingCount).toBe(0);
    expect(summary.rows).toEqual([
      expect.objectContaining({ employeeCode: "E-1", rateBasis: "Basic", rateSalary: 20800, hourlyRate: 100, approvedMinutes: 330, payableMinutes: 330, amount: 1100 }),
    ]);
    expect(summary.totals).toEqual({ approvedMinutes: 330, payableMinutes: 330, amount: 1100 });
  });

  it("uses gross when there is no basic, and caps the month", async () => {
    await testPrisma().hrPolicyRecord.create({ data: { tab: "overtime-setup", officeId: null, data: { basis: "Basic", multiplier: "2", daysPerMonth: "26", hoursPerDay: "8", maxHoursPerMonth: "1" } } });
    await createEntries(adminActor, { entries: [{ employeeId: ids["E-2"], date: "2026-10-05", minutes: 120, source: "Manual" }] });
    const [entry] = await listEntries(adminActor, { from: "2026-10-01", to: "2026-10-31" });
    await decideEntries(adminActor, { ids: [entry.id] }, "Approved");
    // E-2 gross 41,600 → 200/h; capped to 1 h × 200 × 2 = 400.
    const summary = await overtimeSummary(adminActor, { officeId, month: "2026-10" });
    expect(summary.rows[0]).toMatchObject({ rateBasis: "Gross", basicMissing: true, hourlyRate: 200, approvedMinutes: 120, payableMinutes: 60, amount: 400 });
  });

  it("deletes pending entries", async () => {
    await createEntries(adminActor, { entries: [{ employeeId: ids["E-1"], date: "2026-10-07", minutes: 45, source: "Manual" }] });
    const [entry] = await listEntries(adminActor, { from: "2026-10-01", to: "2026-10-31" });
    await deleteEntry(adminActor, entry.id);
    expect(await listEntries(adminActor, { from: "2026-10-01", to: "2026-10-31" })).toEqual([]);
  });
});
