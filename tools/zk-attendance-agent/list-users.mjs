// Quick script: lists all enrolled users on the ZKTeco device.
// Usage: node list-users.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ZKLib = require("node-zklib");

const IP = "192.168.0.119";
const PORT = 4370;
const TIMEOUT = 10000;

const zk = new ZKLib(IP, PORT, TIMEOUT, 4000);
try {
  await zk.createSocket();
  const result = await zk.getUsers();
  const users = Array.isArray(result) ? result : result?.data || [];

  if (users.length === 0) {
    console.log("No users found on the device.");
  } else {
    console.log(`\nTotal users enrolled on ${IP}:${PORT} — ${users.length}\n`);
    console.log(`${"User ID".padEnd(15)} ${"Name".padEnd(30)} ${"Privilege".padEnd(12)} Card`);
    console.log("-".repeat(70));
    for (const u of users) {
      const uid   = String(u.userId   ?? u.user_id   ?? u.uid   ?? "").trim();
      const name  = String(u.name     ?? u.userName  ?? "").trim();
      const priv  = String(u.role     ?? u.privilege ?? u.type  ?? "");
      const card  = String(u.cardno   ?? u.card      ?? "").trim();
      console.log(uid.padEnd(15), name.padEnd(30), priv.padEnd(12), card);
    }
    console.log("-".repeat(70));
    console.log(`Total: ${users.length} user(s)\n`);
  }
} catch (err) {
  console.error("Failed to connect to device:", err.message);
} finally {
  await zk.disconnect().catch(() => {});
}
