import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});
import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createDevice, deleteDevice, listDevices, updateDevice, uploadPunches } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import { admsHandshake, admsPoll, admsUpload, deviceTime, parseAttlog } from "@/features/configuration/gateways/attendance-device/server/adms.service";
import { getDailyAttendance, submitAttendanceAdjustment } from "@/features/hrm/attendance/services/attendance.service";
import { decidePending, pendingApprovals } from "@/features/hrm/governance/server/governance.service";
import { createPolicyRecord } from "@/features/hrm/governance/server/policy-records.service";
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
const filters = { fromDate: "2026-10-28", toDate: "2026-10-28", viewBy: "Employee" as const, employeeId: "ALL", officeId: "ALL", status: "ALL", pageSize: 50, page: 1 };

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

  it("does not match a device user to an employee whose Employee ID equals the number but who has another Attendance ID", async () => {
    const { id } = await device();
    // Rahim (Attendance ID 101) also has Employee ID "E-1"; give someone else's device number his code.
    await testPrisma().employee.update({ where: { id: rahimId }, data: { employeeCode: "555" } });
    expect(await uploadPunches(adminActor, id, { punches: [{ userId: "555", time: "2026-10-28T09:00:00+06:00" }] })).toMatchObject({ unmatched: 1 });
    expect(await testPrisma().attendancePunch.count({ where: { employeeId: rahimId } })).toBe(0);
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
    // Office filter: only employees of the chosen office.
    expect((await getDailyAttendance({ ...filters, officeId })).records).toHaveLength(2);
    expect((await getDailyAttendance({ ...filters, officeId: "00000000-0000-0000-0000-000000000000" })).records).toHaveLength(0);
    expect((await getDailyAttendance({ ...filters, fromDate: "2026-10-27", toDate: "2026-10-27" })).records.map((r) => r.inTime)).toEqual(["11:30 PM"]);
    await expect(getDailyAttendance({ ...filters, fromDate: "2026-01-01" })).rejects.toThrow(/at most/);
  });

  it("marks Late after 9:25 and Absent after 12:00 by default, and follows the office's own rule", async () => {
    const { id } = await device();
    await uploadPunches(adminActor, id, {
      punches: [
        { userId: "101", time: "2026-10-26T09:25:59+06:00" },
        { userId: "101", time: "2026-10-27T09:26:00+06:00" },
        { userId: "101", time: "2026-10-28T12:01:00+06:00" },
        // Early arrivals are on time.
        { userId: "202", time: "2026-10-28T07:40:00+06:00" },
      ],
    });
    const status = async () =>
      (await getDailyAttendance({ ...filters, fromDate: "2026-10-26", toDate: "2026-10-28" })).records.map((r) => `${r.employeeCode} ${r.date} ${r.actualAttendance}`).sort();
    expect(await status()).toEqual(["202 2026-10-28 Present", "E-1 2026-10-26 Present", "E-1 2026-10-27 Late", "E-1 2026-10-28 Absent"]);

    // An office rule from the 27th: late after 9:30, absent after 12:30.
    await createPolicyRecord(adminActor, "attendance-process", { officeId, effectiveFrom: "2026-10-27", data: { dayStart: "08:00", lateAfter: "09:30", absentAfter: "12:30" } });
    expect(await status()).toEqual(["202 2026-10-28 Present", "E-1 2026-10-26 Present", "E-1 2026-10-27 Present", "E-1 2026-10-28 Late"]);
    await expect(createPolicyRecord(adminActor, "attendance-process", { effectiveFrom: "2026-10-27", data: { dayStart: "08:00", lateAfter: "12:00", absentAfter: "09:00" } })).rejects.toThrow(/later than Late After/);
  });

  it("sends a manual status change to HR Pending Approval and applies it only once approved", async () => {
    const { id } = await device();
    await uploadPunches(adminActor, id, { punches: [{ userId: "101", time: "2026-10-28T10:00:00+06:00" }] });
    const row = async () => (await getDailyAttendance({ ...filters, employeeId: rahimId })).records[0];
    expect((await row()).actualAttendance).toBe("Late");

    const submitted = await submitAttendanceAdjustment(adminActor, { employeeId: rahimId, date: "2026-10-28", requestedStatus: "Present", remarks: "Device error", originalStatus: "Late" });
    // Pending: the status is unchanged and the request is shown on the row.
    expect(await row()).toMatchObject({ actualAttendance: "Late", requestAttendance: "Present (Pending HR approval)", adjustmentStatus: "Pending" });
    const pending = await pendingApprovals(adminActor, "attendance");
    expect(pending.rows).toHaveLength(1);
    expect(pending.rows[0]).toMatchObject({ id: submitted.id, current: "Late", requested: "Present", remarks: "Device error" });

    // A second change for the same day replaces the pending one.
    await submitAttendanceAdjustment(adminActor, { employeeId: rahimId, date: "2026-10-28", requestedStatus: "Leave", originalStatus: "Late" });
    expect((await pendingApprovals(adminActor, "attendance")).rows).toHaveLength(1);

    await decidePending(adminActor, "attendance", submitted.id, "Approved");
    expect(await row()).toMatchObject({ actualAttendance: "Leave", adjustmentStatus: "Approved" });
    expect((await pendingApprovals(adminActor, "attendance")).rows).toHaveLength(0);
    await expect(decidePending(adminActor, "attendance", submitted.id, "Rejected")).rejects.toThrow(/already been decided/);

    // A rejected change leaves the approved status as it was; a day without punches gets a row once approved.
    const rejected = await submitAttendanceAdjustment(adminActor, { employeeId: rahimId, date: "2026-10-28", requestedStatus: "Absent" });
    await decidePending(adminActor, "attendance", rejected.id, "Rejected");
    expect((await row()).actualAttendance).toBe("Leave");
    const offday = await submitAttendanceAdjustment(adminActor, { employeeId: rahimId, date: "2026-10-27", requestedStatus: "Offday" });
    await decidePending(adminActor, "attendance", offday.id, "Approved");
    expect((await getDailyAttendance({ ...filters, fromDate: "2026-10-27", toDate: "2026-10-27" })).records.map((r) => r.actualAttendance)).toEqual(["Offday"]);

    await expect(submitAttendanceAdjustment(adminActor, { employeeId: rahimId, date: "2026-10-28", requestedStatus: "Sleeping" })).rejects.toThrow(/valid attendance status/);
  });
});

describe("direct device push (ZKTeco ADMS)", () => {
  const pushDevice = () => createDevice(adminActor, { name: "Gate", ipAddress: "192.168.0.119", port: 4370, serialNumber: "CQZ7233160457", officeId });

  it("converts the device's clock (office time zone) to an instant and reads ATTLOG lines", () => {
    expect(deviceTime("2026-11-23 09:02:11", "Asia/Dhaka")?.toISOString()).toBe("2026-11-23T03:02:11.000Z");
    expect(deviceTime("23/11/2026 09:02", "Asia/Dhaka")).toBeNull();
    const { punches, skipped } = parseAttlog("101\t2026-11-23 09:02:11\t0\t1\t0\t0\r\n\r\nbad line\n202\t2026-11-23 08:55:00\t1\t15\n");
    expect(skipped).toBe(1);
    expect(punches.map((p) => [p.userId, p.state])).toEqual([
      ["101", 0],
      ["202", 1],
    ]);
  });

  it("accepts only registered, active serial numbers and stores pushed punches once", async () => {
    const { id } = await pushDevice();
    await expect(admsHandshake("UNKNOWN1")).rejects.toMatchObject({ status: 404 });
    await expect(admsHandshake(null)).rejects.toMatchObject({ status: 400 });
    const options = await admsHandshake("cqz7233160457");
    expect(options).toContain("GET OPTION FROM: CQZ7233160457");
    expect(options).toContain("TimeZone=6");
    expect((await listDevices(adminActor))[0].lastSyncAt).not.toBeNull();

    const log = "101\t2026-10-28 09:02:11\t0\t1\t0\n303\t2026-10-28 10:00:00\t0\t1\t0\n";
    expect(await admsUpload("CQZ7233160457", "ATTLOG", log)).toBe("OK: 2");
    expect(await admsUpload("CQZ7233160457", "ATTLOG", log)).toBe("OK: 2");
    expect(await admsUpload("CQZ7233160457", "OPERLOG", "OPLOG 4\t0\t2026-10-28 09:00:00")).toBe("OK");
    const punches = await testPrisma().attendancePunch.findMany({ where: { deviceId: id }, orderBy: { punchTime: "asc" } });
    expect(punches.map((p) => [p.deviceUserId, p.employeeId, p.punchTime.toISOString()])).toEqual([
      ["101", rahimId, "2026-10-28T03:02:11.000Z"],
      ["303", null, "2026-10-28T04:00:00.000Z"],
    ]);
    expect(await admsPoll("CQZ7233160457")).toBe("OK");

    await updateDevice(adminActor, id, { name: "Gate", ipAddress: "192.168.0.119", port: 4370, serialNumber: "CQZ7233160457", officeId, isActive: false });
    await expect(admsUpload("CQZ7233160457", "ATTLOG", log)).rejects.toMatchObject({ status: 403 });
  });

  it("answers the device in plain text over HTTP", async () => {
    await pushDevice();
    const cdata = await import("@/app/iclock/cdata/route");
    const unknown = await cdata.GET(new Request("http://erp.test/iclock/cdata?SN=NOPE&options=all"));
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get("content-type")).toMatch(/^text\/plain/);
    const hello = await cdata.GET(new Request("http://erp.test/iclock/cdata?SN=CQZ7233160457&options=all&pushver=2.4.1"));
    expect([hello.status, (await hello.text()).split("\n")[0]]).toEqual([200, "GET OPTION FROM: CQZ7233160457"]);
    const upload = await cdata.POST(new Request("http://erp.test/iclock/cdata?SN=CQZ7233160457&table=ATTLOG&Stamp=0", { method: "POST", body: "101\t2026-10-28 09:02:11\t0\t1\t0\n" }));
    expect(await upload.text()).toBe("OK: 1");
    const poll = await (await import("@/app/iclock/getrequest/route")).GET(new Request("http://erp.test/iclock/getrequest?SN=CQZ7233160457"));
    expect(await poll.text()).toBe("OK");
  });

  it("refuses a serial number already used by another device", async () => {
    await pushDevice();
    await expect(createDevice(adminActor, { name: "Back door", ipAddress: "192.168.0.120", serialNumber: "cqz7233160457", officeId })).rejects.toThrow(/serial number/);
  });
});
