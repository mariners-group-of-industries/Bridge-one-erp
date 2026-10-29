// BridgeOne attendance agent.
//
// Runs on a PC in the same network as the ZKTeco devices. Every INTERVAL_MINUTES it
// asks the ERP which devices are active (Configuration › Community & Gateways ›
// Attendance Devices), reads each device's attendance log over TCP (port 4370) and
// uploads the punches. Uploading the same punch twice is harmless: the ERP stores
// each punch once. Failures are reported to the ERP and shown on the device's row.
//
// Settings (environment variables):
//   ERP_URL           e.g. https://bridge-one-erp.vercel.app          (required)
//   ERP_TOKEN         a "Read & write" API token from API Configuration (required)
//   INTERVAL_MINUTES  minutes between syncs (default 5)
//   DEVICE_TIMEOUT_MS TCP timeout per device (default 10000)
//
//   node agent.mjs          keep running
//   node agent.mjs --once   one sync, then exit (for Task Scheduler / cron)

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ZKLib = require("node-zklib");

// Settings may also live in a .env file next to this script (kept out of git).
const envFile = fileURLToPath(new URL("./.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const ERP_URL = (process.env.ERP_URL || "").replace(/\/+$/, "");
const ERP_TOKEN = process.env.ERP_TOKEN || "";
const INTERVAL_MINUTES = Math.max(1, Number(process.env.INTERVAL_MINUTES || 5));
const DEVICE_TIMEOUT_MS = Math.max(2000, Number(process.env.DEVICE_TIMEOUT_MS || 10000));
const UPLOAD_BATCH = 5000;
/** Punches older than the latest stored one minus this margin are not re-sent. */
const OVERLAP_MS = 24 * 60 * 60 * 1000;

if (!ERP_URL || !ERP_TOKEN) {
  console.error("Set ERP_URL and ERP_TOKEN (a Read & write token from Configuration › API Configuration).");
  process.exit(1);
}

const log = (...parts) => console.log(new Date().toISOString(), ...parts);

async function erp(path, init = {}) {
  const response = await fetch(`${ERP_URL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${ERP_TOKEN}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || body?.error || `ERP answered HTTP ${response.status}`);
  return body.data;
}

/** "2026-10-28T09:02:11+06:00": the device's local wall-clock time with this PC's UTC offset. */
function isoWithOffset(date) {
  const pad = (n) => String(Math.abs(Math.trunc(n))).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}

/** Normalises one attendance record from node-zklib (field names differ between library versions). */
function toPunch(record) {
  const userId = String(record.deviceUserId ?? record.user_id ?? record.userId ?? record.uid ?? "").trim();
  const raw = record.recordTime ?? record.record_time ?? record.timestamp;
  const time = raw instanceof Date ? raw : new Date(raw);
  if (!userId || Number.isNaN(time.getTime())) return null;
  const state = Number.isInteger(record.state) ? record.state : Number.isInteger(record.type) ? record.type : null;
  return { userId: userId.slice(0, 30), time: isoWithOffset(time), state, at: time.getTime() };
}

async function readDevice(device) {
  const zk = new ZKLib(device.ipAddress, device.port, DEVICE_TIMEOUT_MS, 4000);
  try {
    await zk.createSocket();
    const result = await zk.getAttendances();
    const records = Array.isArray(result) ? result : result?.data || [];
    return records.map(toPunch).filter(Boolean);
  } finally {
    await zk.disconnect().catch(() => undefined);
  }
}

async function syncDevice(device) {
  const path = `/api/configuration/gateways/attendance-devices/${device.id}/punches`;
  try {
    const since = device.lastPunchAt ? Date.parse(device.lastPunchAt) - OVERLAP_MS : 0;
    const punches = (await readDevice(device)).filter((p) => p.at >= since).map(({ at: _at, ...p }) => p);
    let inserted = 0;
    let unmatched = 0;
    // An empty upload still marks the device as synced.
    for (let i = 0; i === 0 || i < punches.length; i += UPLOAD_BATCH) {
      const result = await erp(path, { method: "POST", body: JSON.stringify({ punches: punches.slice(i, i + UPLOAD_BATCH) }) });
      inserted += result.inserted;
      unmatched = result.unmatched;
    }
    log(`${device.name} (${device.ipAddress}:${device.port}): read ${punches.length}, ${inserted} new, ${unmatched} unmatched in total`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error?.message ?? error);
    log(`${device.name} (${device.ipAddress}:${device.port}): FAILED — ${message}`);
    await erp(path, { method: "POST", body: JSON.stringify({ punches: [], error: `Agent: ${message}`.slice(0, 500) }) }).catch((reportError) =>
      log(`  could not report the error to the ERP: ${reportError.message}`),
    );
  }
}

async function syncAll() {
  let devices;
  try {
    devices = (await erp("/api/configuration/gateways/attendance-devices")).filter((d) => d.isActive);
  } catch (error) {
    log(`Could not reach the ERP: ${error.message}`);
    return;
  }
  if (devices.length === 0) log("No active devices. Add one in Configuration › Community & Gateways › Attendance Devices.");
  for (const device of devices) await syncDevice(device);
}

await syncAll();
if (!process.argv.includes("--once")) {
  log(`Next sync every ${INTERVAL_MINUTES} minute(s). Press Ctrl+C to stop.`);
  setInterval(syncAll, INTERVAL_MINUTES * 60 * 1000);
}
