/**
 * Lists all device user IDs whose punches are unmatched (no employee Attendance ID
 * or Employee Code maps to them). Run with:
 *   npx tsx scripts/unmatched-punches.ts
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env so DATABASE_URL is available when run outside Next.js
const envPath = resolve(import.meta.dirname, "../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const rows = await db.$queryRaw<
    { deviceUserId: string; punch_count: bigint; earliest: Date; latest: Date }[]
  >`
    SELECT
      ap."deviceUserId",
      COUNT(*)            AS punch_count,
      MIN(ap."punchTime") AS earliest,
      MAX(ap."punchTime") AS latest
    FROM attendance_punches ap
    WHERE ap."employeeId" IS NULL
    GROUP BY ap."deviceUserId"
    ORDER BY punch_count DESC
  `;

  if (rows.length === 0) {
    console.log("\nNo unmatched punches — all device user IDs are linked to an employee.\n");
    return;
  }

  console.log(`\n${"Device User ID".padEnd(20)} ${"Punches".padStart(8)}  ${"Earliest".padEnd(22)}  ${"Latest".padEnd(22)}`);
  console.log("-".repeat(80));
  for (const r of rows) {
    console.log(
      r.deviceUserId.padEnd(20),
      String(r.punch_count).padStart(8),
      " ",
      r.earliest.toISOString().slice(0, 16).padEnd(22),
      r.latest.toISOString().slice(0, 16).padEnd(22),
    );
  }
  console.log("-".repeat(80));
  console.log(`Total unmatched device user IDs: ${rows.length}`);
  console.log(`\nFix: open each employee's profile → Personal Info → set "Attendance ID" to their device user ID.`);
  console.log(`The ERP will automatically re-link their historical punches.\n`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
