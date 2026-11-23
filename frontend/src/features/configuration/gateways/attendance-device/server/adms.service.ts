import { db } from "@/lib/prisma/client";
import { storePunches, type DevicePunch } from "./attendance-device.service";

// ZKTeco "ADMS" push (Device › Comm. › Cloud Server Setting): the device itself
// sends its punches to the ERP over HTTP, so no PC agent and no other cloud
// service sits in between. The device calls, with ?SN=<serial number>:
//   GET  /iclock/cdata          handshake: the ERP answers with the upload options
//   POST /iclock/cdata?table=ATTLOG  punches, one per line (tab separated)
//   GET  /iclock/getrequest     polls for commands (heartbeat)
//   POST /iclock/devicecmd      command results
// A device is accepted only when it is registered (and Active) in Attendance
// Devices with that serial number.

const TIME_ZONE = process.env.APP_TIMEZONE || "Asia/Dhaka";
/** A heartbeat refreshes "Last Sync" at most this often (getrequest comes every few seconds). */
const HEARTBEAT_WRITE_MS = 60_000;

export class AdmsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function pushDevice(serialNumber: string | null) {
  const sn = serialNumber?.trim();
  if (!sn || sn.length > 60) throw new AdmsError("Missing device serial number (SN).", 400);
  const device = await db().attendanceDevice.findFirst({
    where: { serialNumber: { equals: sn, mode: "insensitive" } },
    include: { office: { select: { businessUnitId: true } } },
  });
  if (!device) throw new AdmsError(`Device ${sn} is not registered. Add it in Attendance Devices with this serial number.`, 404);
  if (!device.isActive) throw new AdmsError(`Device ${sn} is inactive.`, 403);
  return device;
}

/** Offset of `timeZone` from UTC at instant `ms`, in ms (Asia/Dhaka: +6 h). */
function zoneOffset(ms: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-11-23 09:02:11" on the device's clock (the office's time zone) → instant. */
export function deviceTime(local: string, timeZone = TIME_ZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  let ms = wall - zoneOffset(wall, timeZone);
  // Across a DST change the first guess can be an hour off; one more pass settles it.
  const again = wall - zoneOffset(ms, timeZone);
  if (again !== ms) ms = again;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ATTLOG lines: PIN \t "YYYY-MM-DD HH:MM:SS" \t status \t verify \t workcode …
 * Unreadable lines are skipped (and counted), so one bad line does not block the rest.
 */
export function parseAttlog(body: string): { punches: DevicePunch[]; skipped: number } {
  const punches: DevicePunch[] = [];
  let skipped = 0;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [pin, time, status] = line.split("\t").map((v) => v.trim());
    const at = time ? deviceTime(time) : null;
    if (!pin || pin.length > 30 || !at) {
      skipped++;
      continue;
    }
    const state = /^\d{1,3}$/.test(status ?? "") && Number(status) <= 255 ? Number(status) : null;
    punches.push({ userId: pin, time: at, state });
  }
  return { punches, skipped };
}

/** Whole hours of the office time zone, as the device's TimeZone option wants it. */
function zoneHours() {
  return Math.round(zoneOffset(Date.now(), TIME_ZONE) / 3_600_000);
}

/** GET /iclock/cdata: the upload options. Punches only (no operation logs, photos or user data). */
export async function admsHandshake(sn: string | null) {
  const device = await pushDevice(sn);
  await db().attendanceDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date(), lastError: null } });
  return [
    `GET OPTION FROM: ${device.serialNumber}`,
    // Send every punch the device holds; the ERP keeps each one once.
    "ATTLOGStamp=None",
    "OPERLOGStamp=9999",
    "ATTPHOTOStamp=9999",
    "ErrorDelay=60",
    "Delay=30",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog",
    `TimeZone=${zoneHours()}`,
    "Realtime=1",
    "Encrypt=None",
  ].join("\n");
}

/** POST /iclock/cdata: stores ATTLOG punches; other tables are acknowledged and ignored. */
export async function admsUpload(sn: string | null, table: string | null, body: string) {
  const device = await pushDevice(sn);
  if ((table ?? "").toUpperCase() !== "ATTLOG") return "OK";
  const { punches, skipped } = parseAttlog(body);
  await storePunches(device, punches, skipped && !punches.length ? { error: `${skipped} punch line(s) could not be read.` } : {});
  // The device counts the lines the server accepted; skipped lines are not worth re-sending.
  return `OK: ${punches.length + skipped}`;
}

/** GET /iclock/getrequest: heartbeat. No commands are sent to the device. */
export async function admsPoll(sn: string | null) {
  const device = await pushDevice(sn);
  if (!device.lastSyncAt || Date.now() - device.lastSyncAt.getTime() > HEARTBEAT_WRITE_MS || device.lastError) {
    await db().attendanceDevice.update({ where: { id: device.id }, data: { lastSyncAt: new Date(), lastError: null } });
  }
  return "OK";
}

/** POST /iclock/devicecmd: command results (the ERP sends none). */
export async function admsCommandResult(sn: string | null) {
  await pushDevice(sn);
  return "OK";
}
