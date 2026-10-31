import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { deviceInputSchema, punchUploadSchema, type DeviceFormOptions, type DeviceInput, type DeviceRow, type PunchUpload, type PunchUploadResult } from "../schemas/attendance-device.schema";

// ─── Scoping ──────────────────────────────────────────────────────────────────

function officeScope(actor: Actor): Prisma.OfficeWhereInput {
  return actor.companyScope === "ALL" ? {} : { businessUnit: { companyId: { in: [...actor.companyScope] } } };
}

/** Devices without an office, or with an office the actor can see. */
function deviceScope(actor: Actor): Prisma.AttendanceDeviceWhereInput {
  return actor.companyScope === "ALL" ? {} : { OR: [{ officeId: null }, { office: officeScope(actor) }] };
}

async function loadDevice(actor: Actor, id: string) {
  const device = await db().attendanceDevice.findFirst({ where: { id, ...deviceScope(actor) }, include: { office: { select: { businessUnitId: true } } } });
  if (!device) throw notFound("Attendance device");
  return device;
}

const orNull = (value: string) => (value === "" ? null : value);

// ─── Devices ──────────────────────────────────────────────────────────────────

export async function listDevices(actor: Actor): Promise<DeviceRow[]> {
  const devices = await db().attendanceDevice.findMany({
    where: deviceScope(actor),
    orderBy: { name: "asc" },
    include: { office: { select: { name: true } }, _count: { select: { punches: true } } },
  });
  if (devices.length === 0) return [];
  const ids = devices.map((d) => d.id);
  const [latest, unmatched] = await Promise.all([
    db().attendancePunch.groupBy({ by: ["deviceId"], where: { deviceId: { in: ids } }, _max: { punchTime: true } }),
    db().attendancePunch.groupBy({ by: ["deviceId"], where: { deviceId: { in: ids }, employeeId: null }, _count: { _all: true } }),
  ]);
  const latestOf = new Map(latest.map((r) => [r.deviceId, r._max.punchTime]));
  const unmatchedOf = new Map(unmatched.map((r) => [r.deviceId, r._count._all]));
  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    ipAddress: d.ipAddress,
    port: d.port,
    serialNumber: d.serialNumber ?? "",
    officeId: d.officeId ?? "",
    officeName: d.office?.name ?? null,
    isActive: d.isActive,
    lastSyncAt: d.lastSyncAt?.toISOString() ?? null,
    lastSyncCount: d.lastSyncCount,
    lastError: d.lastError,
    lastPunchAt: latestOf.get(d.id)?.toISOString() ?? null,
    punchCount: d._count.punches,
    unmatchedCount: unmatchedOf.get(d.id) ?? 0,
  }));
}

export async function deviceFormOptions(actor: Actor): Promise<DeviceFormOptions> {
  return { offices: await db().office.findMany({ where: officeScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }) };
}

async function toData(actor: Actor, input: DeviceInput) {
  const data = deviceInputSchema.parse(input);
  if (data.officeId && !(await db().office.findFirst({ where: { id: data.officeId, ...officeScope(actor) }, select: { id: true } }))) {
    throw badRequest("Select an office you can access.");
  }
  return { name: data.name, ipAddress: data.ipAddress, port: data.port, serialNumber: orNull(data.serialNumber), officeId: orNull(data.officeId), isActive: data.isActive };
}

const duplicate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? conflict("Another device already uses this IP address and port.") : error;

export async function createDevice(actor: Actor, input: DeviceInput) {
  const data = await toData(actor, input);
  try {
    return await db().attendanceDevice.create({ data, select: { id: true } });
  } catch (error) {
    throw duplicate(error);
  }
}

export async function updateDevice(actor: Actor, id: string, input: DeviceInput) {
  const before = await loadDevice(actor, id);
  const data = await toData(actor, input);
  try {
    await db().attendanceDevice.update({ where: { id }, data });
  } catch (error) {
    throw duplicate(error);
  }
  // A new office changes which employees the device's punches belong to.
  if (before.officeId !== data.officeId) await rematch(id);
  return { id };
}

/** Only devices without punches can be deleted (attendance history is kept); deactivate the others. */
export async function deleteDevice(actor: Actor, id: string) {
  await loadDevice(actor, id);
  if (await db().attendancePunch.count({ where: { deviceId: id } })) {
    throw badRequest("This device has attendance punches. Deactivate it instead, so its history is kept.");
  }
  await db().attendanceDevice.delete({ where: { id } });
}

// ─── Punches ──────────────────────────────────────────────────────────────────

/**
 * Device user number → employee id, by Attendance ID first, then Employee ID, within the device's business unit.
 * The Employee ID only counts for employees without an Attendance ID: one who has one punches with that number,
 * so another device user whose number equals their Employee ID is someone else.
 */
async function employeeMap(device: { office: { businessUnitId: string } | null }, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const where: Prisma.EmployeeWhereInput = {
    ...(device.office ? { office: { businessUnitId: device.office.businessUnitId } } : {}),
    OR: [{ attendanceId: { in: userIds } }, { employeeCode: { in: userIds } }],
  };
  const employees = await db().employee.findMany({ where, select: { id: true, attendanceId: true, employeeCode: true, isActive: true }, orderBy: { isActive: "desc" } });
  const map = new Map<string, string>();
  for (const e of employees) if (e.employeeCode && !e.attendanceId && !map.has(e.employeeCode)) map.set(e.employeeCode, e.id);
  // Attendance ID wins over Employee ID.
  for (const e of employees) if (e.attendanceId) map.set(e.attendanceId, e.id);
  return map;
}

/**
 * Re-links the device's punches to employees. `unmatchedOnly` (after each upload)
 * links punches that had no employee yet, e.g. because the Attendance ID was set
 * later; otherwise (the device's office changed) every punch is re-linked.
 */
async function rematch(deviceId: string, unmatchedOnly = false) {
  const device = await db().attendanceDevice.findUniqueOrThrow({ where: { id: deviceId }, include: { office: { select: { businessUnitId: true } } } });
  const scope = { deviceId, ...(unmatchedOnly ? { employeeId: null } : {}) };
  const pending = await db().attendancePunch.findMany({ where: scope, distinct: ["deviceUserId"], select: { deviceUserId: true } });
  const map = await employeeMap(device, pending.map((p) => p.deviceUserId));
  for (const { deviceUserId } of pending) {
    const employeeId = map.get(deviceUserId) ?? null;
    // Unknown users stay unmatched; there is nothing to write for them.
    if (unmatchedOnly && !employeeId) continue;
    // Only rows that change (in SQL, NULL <> x is not true, so empty rows are listed explicitly).
    const changes: Prisma.AttendancePunchWhereInput = employeeId ? { OR: [{ employeeId: null }, { employeeId: { not: employeeId } }] } : { employeeId: { not: null } };
    await db().attendancePunch.updateMany({ where: { ...scope, deviceUserId, ...changes }, data: { employeeId } });
  }
}

/**
 * Stores punches uploaded by the attendance agent. Re-uploading the same punches
 * is harmless (they are stored once). With `error`, only the device's sync status
 * is updated.
 */
export async function uploadPunches(actor: Actor, deviceId: string, input: PunchUpload): Promise<PunchUploadResult> {
  const data = punchUploadSchema.parse(input);
  const device = await loadDevice(actor, deviceId);
  if (!device.isActive) throw badRequest("This device is inactive. Activate it in Attendance Devices first.");

  let inserted = 0;
  if (data.punches.length) {
    const map = await employeeMap(device, [...new Set(data.punches.map((p) => p.userId))]);
    for (let i = 0; i < data.punches.length; i += 1000) {
      const batch = data.punches.slice(i, i + 1000);
      const { count } = await db().attendancePunch.createMany({
        data: batch.map((p) => ({ deviceId, deviceUserId: p.userId, employeeId: map.get(p.userId) ?? null, punchTime: new Date(p.time), punchState: p.state ?? null })),
        skipDuplicates: true,
      });
      inserted += count;
    }
  }
  // Earlier punches may belong to employees whose Attendance ID was set since.
  if (!data.error && (await db().attendancePunch.count({ where: { deviceId, employeeId: null } }))) await rematch(deviceId, true);

  await db().attendanceDevice.update({
    where: { id: deviceId },
    data: {
      lastSyncAt: new Date(),
      lastSyncCount: data.error ? device.lastSyncCount : inserted,
      lastError: data.error ?? null,
      ...(data.serialNumber && !device.serialNumber ? { serialNumber: data.serialNumber } : {}),
    },
  });
  const unmatched = await db().attendancePunch.count({ where: { deviceId, employeeId: null } });
  return { received: data.punches.length, inserted, duplicates: data.punches.length - inserted, unmatched };
}
