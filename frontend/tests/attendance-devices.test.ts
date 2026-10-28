import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createDevice, deleteDevice, listDevices, updateDevice, uploadPunches } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { getDailyAttendance } from "@/features/hrm/attendance/services/attendance.service";
import { actionOf } from "@/lib/audit/record";
import { AppError } from "@/lib/api/errors";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let officeId: string;
let rahimId: string;

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
  await testPrisma().employee.create({ data: { officeId, employeeCode: "202", name: "Karim", joiningDate: new Date("2024-01-01") } });
});

const device = () => createDevice(adminActor, { name: "Gate", ipAddress: "192.168.0.119", port: 4370, officeId });
const filters = { fromDate: "2026-10-28", toDate: "2026-10-28", viewBy: "Employee" as const, employeeId: "ALL", status: "ALL", pageSize: 50, page: 1 };

describe("attendance devices", () => {
  it("validates devices and refuses a second device on the same address", async () => {
    await device();
    await expect(device()).rejects.toBeInstanceOf(AppError);
    await expect(createDevice(adminActor, { name: "X", ipAddress: "999.1.1.1" })).rejects.toThrow();
    expect((await listDevices(adminActor))[0]).toMatchObject({ name: "Gate", ipAddress: "192.168.0.119", port: 4370, punchCount: 0, lastSyncAt: null });
  });

  it("stores punches once, matches Attendance ID then Employee ID, and links unknown users later", async () => {
    const { id } = await device();
    const punches = [
      { userId: "101", time: "2026-10-28T09:02:11+06:00", state: 0 },
      { userId: "101", time: "2026-10-28T13:00:00+06:00" },
      { userId: "101", time: "2026-10-28T18:05:40+06:00", state: 1 },
      { userId: "202", time: "2026-10-28T08:55:00+06:00" },
      { userId: "303", time: "2026-10-28T10:00:00+06:00" },
    ];
    expect(await uploadPunches(adminActor, id, { punches })).toEqual({ received: 5, inserted: 5, duplicates: 0, unmatched: 1 });
    // The agent re-sends overlapping punches; they are stored once.
    expect(await uploadPunches(adminActor, id, { punches })).toMatchObject({ inserted: 0, duplicates: 5 });

    // Unknown user 303 gets an Attendance ID: linked on the next upload.
    const salma = await testPrisma().employee.create({ data: { officeId, employeeCode: "E-3", attendanceId: "303", name: "Salma", joiningDate: new Date("2024-01-01") } });
    expect(await uploadPunches(adminActor, id, { punches: [] })).toMatchObject({ unmatched: 0 });
    expect(await testPrisma().attendancePunch.count({ where: { employeeId: salma.id } })).toBe(1);

    const [row] = await listDevices(adminActor);
    expect(row).toMatchObject({ punchCount: 5, unmatchedCount: 0, lastError: null, lastPunchAt: "2026-10-28T12:05:40.000Z" });
    expect(row.lastSyncAt).not.toBeNull();
  });

  it("records agent errors on the device, refuses inactive devices and keeps history on delete", async () => {
    const { id } = await device();
    await uploadPunches(adminActor, id, { punches: [], error: "Agent: connect ETIMEDOUT 192.168.0.119:4370" });
    expect((await listDevices(adminActor))[0].lastError).toContain("ETIMEDOUT");
    await uploadPunches(adminActor, id, { punches: [{ userId: "101", time: "2026-10-28T09:00:00+06:00" }] });
    expect((await listDevices(adminActor))[0].lastError).toBeNull();

    await expect(deleteDevice(adminActor, id)).rejects.toBeInstanceOf(AppError);
    await updateDevice(adminActor, id, { name: "Gate", ipAddress: "192.168.0.119", port: 4370, officeId, isActive: false });
    await expect(uploadPunches(adminActor, id, { punches: [] })).rejects.toBeInstanceOf(AppError);
    expect(actionOf("POST", `/api/configuration/gateways/attendance-devices/${id}/punches`)).toBeNull();
  });
});

describe("HRM daily attendance from punches", () => {
  it("shows first in and last out per employee and local day", async () => {
    const { id } = await device();
    await uploadPunches(adminActor, id, {
      punches: [
        { userId: "101", time: "2026-10-28T09:02:11+06:00" },
        { userId: "101", time: "2026-10-28T13:00:00+06:00" },
        { userId: "101", time: "2026-10-28T18:05:40+06:00" },
        { userId: "202", time: "2026-10-28T08:55:00+06:00" },
        // 23:30 on the 27th in Dhaka is still the 27th, although it is 17:30 UTC.
        { userId: "101", time: "2026-10-27T23:30:00+06:00" },
      ],
    });
    const { records } = await getDailyAttendance(filters);
    expect(records.map((r) => [r.employeeCode, r.date, r.inTime, r.outTime, r.actualAttendance, r.inTimeLocation])).toEqual([
      ["202", "2026-10-28", "08:55 AM", null, "Present", "Gate"],
      ["E-1", "2026-10-28", "09:02 AM", "06:05 PM", "Present", "Gate"],
    ]);
    expect(records[1].remarks).toBe("3 punches");
    expect((await getDailyAttendance({ ...filters, employeeId: rahimId })).records).toHaveLength(1);
    expect((await getDailyAttendance({ ...filters, fromDate: "2026-10-27", toDate: "2026-10-27" })).records.map((r) => r.inTime)).toEqual(["11:30 PM"]);
    await expect(getDailyAttendance({ ...filters, fromDate: "2026-01-01" })).rejects.toThrow(/at most/);
  });
});
