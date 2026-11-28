import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createDevice, uploadPunches } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { getDailyAttendance } from "@/features/hrm/attendance/services/attendance.service";
import { calendarDefinitions, loadCalendarDays, saveCalendarDays } from "@/features/hrm/calendar-assign/services/calendar-assign.service";
import { createPolicyRecord } from "@/features/hrm/governance/server/policy-records.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let officeId: string;
let rahimId: string;
let karimId: string;

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
  rahimId = (await testPrisma().employee.create({ data: { officeId, employeeCode: "E-1", attendanceId: "101", name: "Rahim", joiningDate: new Date("2024-01-01") } })).id;
  karimId = (await testPrisma().employee.create({ data: { officeId, employeeCode: "E-2", attendanceId: "202", name: "Karim", joiningDate: new Date("2024-01-01") } })).id;
  // Calendar Setup: a day shift and a night shift for the office.
  await createPolicyRecord(adminActor, "calendar-setup", { officeId, data: { name: "General-G", shortCode: "G", startTime: "09:00", endTime: "18:00", minWorkHours: 8, graceTime: "09:15", lastStartTime: "12:00" } });
  await createPolicyRecord(adminActor, "calendar-setup", { officeId, data: { name: "Night", shortCode: "N", startTime: "22:00", endTime: "06:00", minWorkHours: 8, graceTime: "22:15", lastStartTime: "22:30" } });
  await createPolicyRecord(adminActor, "calendar-setup", { officeId, data: { name: "Morning", shortCode: "A", startTime: "06:00", endTime: "14:00", minWorkHours: 8, graceTime: "06:10", lastStartTime: "08:00" } });
});

const filters = (fromDate: string, toDate: string) => ({ fromDate, toDate, viewBy: "Employee" as const, employeeId: "ALL", officeId: "ALL", status: "ALL", pageSize: 50, page: 1 });
const punch = async (...times: [string, string][]) => {
  const { id } = await createDevice(adminActor, { name: "Gate", ipAddress: "192.168.0.119", port: 4370, officeId });
  await uploadPunches(adminActor, id, { punches: times.map(([userId, time]) => ({ userId, time })) });
};
const rows = async (from: string, to: string, employeeId = "ALL") =>
  (await getDailyAttendance({ ...filters(from, to), employeeId })).records
    .map((r) => `${r.employeeCode} ${r.date} ${r.actualAttendance} | ${r.calendarName} | ${r.inTime ?? "-"} ${r.outTime ?? "-"}${r.remarks ? ` | ${r.remarks}` : ""}`)
    .sort();

describe("calendar assign → attendance", () => {
  it("saves the grid in the database, refuses unknown codes, and clears empty days", async () => {
    const days = { "2026-10-27": "G", "2026-10-28": "OFF", "2026-10-29": "N" };
    expect(await saveCalendarDays(adminActor, { from: "2026-10-27", to: "2026-10-29", assignments: { [rahimId]: days } })).toEqual({ saved: 3, cleared: 0 });
    expect(await loadCalendarDays([rahimId], "2026-10-01", "2026-10-31")).toEqual({ [rahimId]: days });

    // A code that is not in Calendar Setup for the office: nothing is saved.
    await expect(saveCalendarDays(adminActor, { from: "2026-10-27", to: "2026-10-27", assignments: { [rahimId]: { "2026-10-27": "ZZ" } } })).rejects.toThrow(/E-1 (.+) has no "ZZ"/);
    expect((await loadCalendarDays([rahimId], "2026-10-27", "2026-10-27"))[rahimId]["2026-10-27"]).toBe("G");

    // Codes are case-sensitive: "g" is not "G".
    await expect(saveCalendarDays(adminActor, { from: "2026-10-27", to: "2026-10-27", assignments: { [rahimId]: { "2026-10-27": "g" } } })).rejects.toThrow(/E-1 (.+) has no "g"/);

    // Saving the range again with an empty day clears it; days outside the range are kept.
    expect(await saveCalendarDays(adminActor, { from: "2026-10-28", to: "2026-10-29", assignments: { [rahimId]: { "2026-10-28": "", "2026-10-29": "G" } } })).toEqual({ saved: 1, cleared: 1 });
    expect(await loadCalendarDays([rahimId], "2026-10-01", "2026-10-31")).toEqual({ [rahimId]: { "2026-10-27": "G", "2026-10-29": "G" } });
  });

  it("uses the assigned calendar for Late / Absent, marks off days, and adds Absent for a working day with no punch", async () => {
    await saveCalendarDays(adminActor, { from: "2026-10-27", to: "2026-10-29", assignments: { [rahimId]: { "2026-10-27": "G", "2026-10-28": "OFF", "2026-10-29": "G" } } });
    await punch(
      ["101", "2026-10-27T09:20:00+06:00"], // after G's grace (09:15): Late
      ["101", "2026-10-27T18:02:00+06:00"],
      ["101", "2026-10-28T09:00:00+06:00"], // on the off day
      ["202", "2026-10-29T09:20:00+06:00"], // Karim has no calendar: the default rule (late after 09:25)
    );
    expect(await rows("2026-10-27", "2026-10-29")).toEqual([
      "E-1 2026-10-27 Late | General-G (G) | 09:20 AM 06:02 PM",
      "E-1 2026-10-28 Offday | Weekly Off | 09:00 AM - | Punched on an off day",
      "E-1 2026-10-29 Absent | General-G (G) | - - | No punch",
      "E-2 2026-10-29 Present | Not assigned | 09:20 AM -",
    ]);
    // The office filter keeps calendar rows too.
    expect((await getDailyAttendance({ ...filters("2026-10-27", "2026-10-29"), officeId })).records).toHaveLength(4);
  });

  it("counts a night shift's after-midnight punches for the night it started", async () => {
    await saveCalendarDays(adminActor, { from: "2026-10-27", to: "2026-10-28", assignments: { [rahimId]: { "2026-10-27": "N", "2026-10-28": "A" }, [karimId]: { "2026-10-27": "N" } } });
    await punch(
      ["101", "2026-10-27T22:10:00+06:00"],
      ["101", "2026-10-28T04:55:00+06:00"], // out from the night (before 06:00 + 4 h, and an hour before A starts)
      ["101", "2026-10-28T06:05:00+06:00"], // in for Morning A on the 28th
      ["202", "2026-10-28T00:10:00+06:00"], // 00:10 is after N's last start (22:30): Absent
    );
    expect(await rows("2026-10-27", "2026-10-28")).toEqual([
      "E-1 2026-10-27 Present | Night (N) | 10:10 PM 04:55 AM",
      "E-1 2026-10-28 Present | Morning (A) | 06:05 AM -",
      "E-2 2026-10-27 Absent | Night (N) | 12:10 AM -",
    ]);
  });

  it("follows HR Governance: Holidays, Off Day and Roster, with Calendar Assign overriding them", async () => {
    await createPolicyRecord(adminActor, "off-day", { officeId, effectiveFrom: "2026-01-01", data: { days: ["Friday"] } });
    await createPolicyRecord(adminActor, "holidays", { officeId, data: { name: "2026 Holidays", year: 2026, holidays: [{ date: "2026-10-26", title: "Durga Puja", holidayType: "Religious" }] } });
    await createPolicyRecord(adminActor, "roster", { officeId, employeeId: rahimId, effectiveFrom: "2026-10-01", data: { calendar: "General-G", pattern: "Fixed" } });
    await punch(["101", "2026-10-22T09:05:00+06:00"]);

    expect(await rows("2026-10-22", "2026-10-26", rahimId)).toEqual([
      "E-1 2026-10-22 Present | General-G (G) | 09:05 AM -",
      "E-1 2026-10-23 Offday | Weekly Off | - -",
      "E-1 2026-10-24 Absent | General-G (G) | - - | No punch",
      "E-1 2026-10-25 Absent | General-G (G) | - - | No punch",
      "E-1 2026-10-26 Holiday | Holiday | - - | Durga Puja",
    ]);

    // A working day assigned on Calendar Assign wins over the holiday.
    await saveCalendarDays(adminActor, { from: "2026-10-26", to: "2026-10-26", assignments: { [rahimId]: { "2026-10-26": "G" } } });
    expect(await rows("2026-10-26", "2026-10-26", rahimId)).toEqual(["E-1 2026-10-26 Absent | General-G (G) | - - | No punch"]);
  });

  it("rotates a rotational roster every N days", async () => {
    await createPolicyRecord(adminActor, "roster", { officeId, employeeId: rahimId, effectiveFrom: "2026-10-01", effectiveTo: "2026-10-06", data: { calendar: "Morning", pattern: "Rotational", nextCalendar: "General-G", rotateEveryDays: 2 } });
    const labels = (await getDailyAttendance({ ...filters("2026-10-01", "2026-10-07"), employeeId: rahimId })).records.map((r) => `${r.date} ${r.calendarName}`).sort();
    // The roster ends on the 6th, so the 7th has no plan (and no row without punches).
    expect(labels).toEqual([
      "2026-10-01 Morning (A)",
      "2026-10-02 Morning (A)",
      "2026-10-03 General-G (G)",
      "2026-10-04 General-G (G)",
      "2026-10-05 Morning (A)",
      "2026-10-06 Morning (A)",
    ]);
  });

  it("lists Calendar Setup calendars (12-hour times) plus Weekly Off and Holiday", async () => {
    const list = await calendarDefinitions();
    expect(list.map((c) => `${c.shortCode} ${c.calendarName} ${c.startTime}-${c.endTime} grace ${c.graceTime}`)).toEqual([
      "A Morning 6:00 AM-2:00 PM grace 6:10 AM",
      "G General-G 9:00 AM-6:00 PM grace 9:15 AM",
      "N Night 10:00 PM-6:00 AM grace 10:15 PM",
      "OFF Weekly Off --- grace -",
      "HOL Holiday --- grace -",
    ]);
    expect(list[0].office).toBe(officeInput.name);
  });
});
