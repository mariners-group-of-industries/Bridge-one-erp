
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
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

/** Hosts on this PC's local /24 networks that accept TCP connections on `port`. */
async function hostsListening(port) {
  const prefixes = new Set();
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === "IPv4" && !a.internal && /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a.address)) prefixes.add(a.address.split(".").slice(0, 3).join("."));
    }
  }
  const probe = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ host, port, timeout: 1500 });
      const done = (open) => {
        socket.destroy();
        resolve(open ? host : null);
      };
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });
  const found = [];
  for (const prefix of prefixes) {
    const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
    for (let i = 0; i < hosts.length; i += 64) found.push(...(await Promise.all(hosts.slice(i, i + 64).map(probe))).filter(Boolean));
  }
  return found;
}

const unreachable = (error) => error?.command === "TCP CONNECT" || /ETIMEDOUT|EHOSTUNREACH|ECONNREFUSED/.test(String(error?.err?.message ?? error?.message ?? ""));

/**
 * Reads the device at its configured address. When that address does not answer
 * (the device got a new IP from DHCP) and this is the only device, the local
 * network is searched for it; the address found is logged so it can be fixed in the ERP.
 */
async function readDevice(device, { canSearch }) {
  try {
    return await readDeviceAt(device.ipAddress, device.port);
  } catch (error) {
    if (!canSearch || !unreachable(error)) throw error;
    const candidates = (await hostsListening(device.port)).filter((host) => host !== device.ipAddress);
    if (candidates.length !== 1) throw error;
    const [found] = candidates;
    log(`${device.name}: no answer at ${device.ipAddress}; found an attendance device at ${found}. Set its IP Address to ${found} in the ERP.`);
    return readDeviceAt(found, device.port);
  }
}

async function readDeviceAt(ipAddress, port) {
  const zk = new ZKLib(ipAddress, port, DEVICE_TIMEOUT_MS, 4000);
  try {
    await zk.createSocket();
    const result = await zk.getAttendances();
    const records = Array.isArray(result) ? result : result?.data || [];
    return records.map(toPunch).filter(Boolean);
  } finally {
    await zk.disconnect().catch(() => undefined);
  }
}

async function syncDevice(device, canSearch) {
  const path = `/api/configuration/gateways/attendance-devices/${device.id}/punches`;
  try {
    const since = device.lastPunchAt ? Date.parse(device.lastPunchAt) - OVERLAP_MS : 0;
    const punches = (await readDevice(device, { canSearch })).filter((p) => p.at >= since).map(({ at: _at, ...p }) => p);
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
    // node-zklib rejects with { err: Error, ip, command } rather than an Error.
    const cause = error instanceof Error ? error : (error?.err ?? error);
    const detail = cause instanceof Error ? cause.message : String(cause?.message ?? cause);
    const message = error?.command ? `${detail} (during ${error.command})` : detail;
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
  // Searching the network only makes sense when there is a single device to look for.
  for (const device of devices) await syncDevice(device, devices.length === 1);
}

await syncAll();
if (!process.argv.includes("--once")) {
  log(`Next sync every ${INTERVAL_MINUTES} minute(s). Press Ctrl+C to stop.`);
  setInterval(syncAll, INTERVAL_MINUTES * 60 * 1000);
}
