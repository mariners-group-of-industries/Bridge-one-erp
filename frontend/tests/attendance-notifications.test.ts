import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

import { createBusinessUnit } from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { saveCompany } from "@/features/configuration/business-config/company-profile/server/company.service";
import { createOffice } from "@/features/configuration/business-config/company-profile/server/office.service";
import { createDevice, uploadPunches } from "@/features/configuration/gateways/attendance-device/server/attendance-device.service";
import {
  formatAttendanceMessage,
  processPendingAttendanceNotifications,
  saveNotificationSettings,
} from "@/features/configuration/gateways/attendance-notifications/server/attendance-notification.service";
import { dayKey } from "@/features/hrm/attendance/services/attendance.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb, testPrisma } from "./helpers/test-db";

let deviceId: string;
let employeeId: string;

beforeAll(async () => {
  await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  await saveCompany(adminActor, companyInput);
  const bu = await createBusinessUnit(adminActor, businessUnitInput);
  const office = await createOffice(adminActor, bu.id, officeInput);
  const dev = await createDevice(adminActor, {
    name: "Main Gate MB460",
    ipAddress: "192.168.0.119",
    port: 4370,
    officeId: office.id,
    isActive: true,
  });
  deviceId = dev.id;

  const emp = await testPrisma().employee.create({
    data: {
      officeId: office.id,
      employeeCode: "EMP-101",
      attendanceId: "101",
      name: "Md. Mizanur Rahman",
      designation: "Assistant Manager, Supply Chain Management",
      department: "Supply Chain",
      joiningDate: new Date("2024-01-01"),
      isActive: true,
    },
  });
  employeeId = emp.id;

  delete process.env.WHATSAPP_GATEWAY_URL;
  delete process.env.WHATSAPP_GATEWAY_TOKEN;
});

describe("attendance whatsapp notifications", () => {
  it("formats the exact WhatsApp attendance template", () => {
    const msg = formatAttendanceMessage(
      "Assalamualaikum Sir,\nName: {employee_name} (ID: {employee_id})\nDesig: {designation}\nIn-Time: {date} at {time} ({status} as per software report)",
      {
        employeeName: "Md. Mizanur Rahman",
        employeeCode: "EMP-101",
        designation: "Assistant Manager, Supply Chain Management",
        department: "Supply Chain",
        date: "2026-11-18",
        time: "09:29 AM",
        status: "Late",
      },
    );
    expect(msg).toBe(
      "Assalamualaikum Sir,\nName: Md. Mizanur Rahman (ID: EMP-101)\nDesig: Assistant Manager, Supply Chain Management\nIn-Time: 18-11-2026 at 09:29 AM (Late as per software report)",
    );
  });

  it("enqueues one idempotent outbox entry per employee/day on punch and delivers via gateway", async () => {
    process.env.WHATSAPP_GATEWAY_URL = "http://127.0.0.1:3100";
    process.env.WHATSAPP_GATEWAY_TOKEN = "secret-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, messageId: "wamid-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await saveNotificationSettings(adminActor, {
      enabled: true,
      notifyCheckIn: true,
      notifyLate: true,
      notifyCheckOut: false,
      whatsappGroupId: "120363012345678901@g.us",
      whatsappGroupName: "Attendance Alerts",
      departmentFilter: null,
      messageTemplate:
        "Assalamualaikum Sir,\nName: {employee_name} (ID: {employee_id})\nDesig: {designation}\nIn-Time: {date} at {time} ({status} as per software report)",
    });

    const today = dayKey.format(new Date());
    // 10:30 AM Asia/Dhaka (+06:00) is Late against default 09:25 AM rule.
    const punchIso = `${today}T10:30:00+06:00`;
    const first = await uploadPunches(adminActor, deviceId, {
      punches: [{ userId: "101", time: punchIso }],
    });
    expect(first.inserted).toBe(1);

    const outbox = await testPrisma().attendanceNotificationOutbox.findMany({ where: { employeeId } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].status).toBe("SENT");
    expect(outbox[0].attendanceStatus).toBe("Late");
    expect(outbox[0].gatewayMessageId).toBe("wamid-123");
    expect(outbox[0].messageText).toContain("Md. Mizanur Rahman (ID: EMP-101)");
    expect(outbox[0].messageText).toContain("Late as per software report");

    // Re-punching later the same day must NOT create a duplicate notification.
    await uploadPunches(adminActor, deviceId, {
      punches: [{ userId: "101", time: `${today}T10:35:00+06:00` }],
    });
    const outboxAfter = await testPrisma().attendanceNotificationOutbox.findMany({ where: { employeeId } });
    expect(outboxAfter).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });

  it("sends Check-Out notification once when notifyCheckOut is enabled and employee punches out later", async () => {
    process.env.WHATSAPP_GATEWAY_URL = "http://127.0.0.1:3100";
    process.env.WHATSAPP_GATEWAY_TOKEN = "secret-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accepted: true, messageId: "wamid-out" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await saveNotificationSettings(adminActor, {
      enabled: true,
      notifyCheckIn: true,
      notifyLate: true,
      notifyCheckOut: true,
      whatsappGroupId: "120363012345678901@g.us",
      whatsappGroupName: "Attendance Alerts",
      departmentFilter: null,
      messageTemplate:
        "Assalamualaikum Sir,\nName: {employee_name} (ID: {employee_id})\nDesig: {designation}\nIn-Time: {date} at {time} ({status} as per software report)",
    });

    const today = dayKey.format(new Date());
    await uploadPunches(adminActor, deviceId, {
      punches: [{ userId: "101", time: `${today}T09:00:00+06:00` }],
    });
    await uploadPunches(adminActor, deviceId, {
      punches: [{ userId: "101", time: `${today}T17:30:00+06:00` }],
    });

    const outbox = await testPrisma().attendanceNotificationOutbox.findMany({
      where: { employeeId },
      orderBy: { createdAt: "asc" },
    });
    expect(outbox).toHaveLength(2);
    expect(outbox[0].eventType).toBe("CHECK_IN");
    expect(outbox[1].eventType).toBe("CHECK_OUT");
    expect(outbox[1].messageText).toContain("Out-Time:");
    expect(outbox[1].messageText).toContain("(Checked Out)");

    fetchSpy.mockRestore();
  });

  it("never fails attendance ingestion when the WhatsApp gateway is offline", async () => {
    process.env.WHATSAPP_GATEWAY_URL = "http://127.0.0.1:3100";
    process.env.WHATSAPP_GATEWAY_TOKEN = "secret-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "WhatsApp offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await saveNotificationSettings(adminActor, {
      enabled: true,
      notifyCheckIn: true,
      notifyLate: true,
      notifyCheckOut: false,
      whatsappGroupId: "120363012345678901@g.us",
      whatsappGroupName: null,
      departmentFilter: null,
      messageTemplate: "In: {employee_name} ({status})",
    });

    const today = dayKey.format(new Date());
    const result = await uploadPunches(adminActor, deviceId, {
      punches: [{ userId: "101", time: `${today}T09:00:00+06:00` }],
    });
    expect(result.inserted).toBe(1);

    const outbox = await testPrisma().attendanceNotificationOutbox.findMany({ where: { employeeId } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].status).toBe("FAILED");
    expect(outbox[0].attempts).toBe(1);
    expect(outbox[0].lastError).toContain("WhatsApp offline");

    // Process queue before nextRetryAt should not retry prematurely.
    expect(await processPendingAttendanceNotifications(10)).toBe(0);

    fetchSpy.mockRestore();
  });
});
