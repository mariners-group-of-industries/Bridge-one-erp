/**
 * import-employees-json.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Imports an "Employee List — All Details" JSON export into Configuration →
 * Employee Management. Employees that already exist are skipped (never changed).
 *
 * DRY RUN by default: reads the database and prints what would happen.
 * Pass --apply to write.
 *
 * USAGE (from frontend/):
 *   npx esbuild scripts/import-employees-json.ts --bundle --platform=node --format=cjs \
 *     --packages=external --define:import.meta.url=__importMetaUrl  *     --banner:js="const __importMetaUrl = require('url').pathToFileURL(__filename).href;"  *     --outfile=node_modules/.cache/import-employees-json.cjs
 *   node --env-file=.env node_modules/.cache/import-employees-json.cjs <file.json> [--apply]
 *
 * Per row:
 *   Employee Id   → employeeCode  (matched per business unit, like the Excel upload)
 *   Attendance Id → attendanceId
 *   Office Name   → office (by name, case-insensitive)
 *   Type          → employeeType
 *   Mobile/User   → mobile
 *   User Role     → Account Settings flags: User → isUser, MasterUser → isUser + isMasterUser
 *   Salary > 0    → Salary tab: gross, cash ("Day Basis" type → day-basis salary)
 *   Status        → isActive
 * Placeholder values ("21" in Department / Termination Date) are ignored.
 * Duplicate rows in the file (same Employee Id) are imported once.
 * No ERP logins are created; add those from each employee's profile.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "node:fs";
import { db } from "../src/lib/prisma/client";

interface SourceRow {
  "Employee Id": string;
  "Attendance Id"?: string;
  "Employee Name": string;
  Designation?: string;
  Department?: string;
  "Office Name": string;
  "Joining Date": string;
  "Termination Date"?: string;
  "Mobile/User"?: string;
  Type?: string;
  Salary?: number | string;
  "User Role"?: string;
  Status?: string;
}

const PLACEHOLDER = "21";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Trims, drops invisible characters and collapses spaces; blank / placeholder → undefined. */
function clean(value: unknown, max: number): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/[​-‍⁠﻿]/g, "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (!text || text === PLACEHOLDER) return undefined;
  return text.slice(0, max);
}

const key = (value: string) => value.trim().toLowerCase();
const ROLE_RANK: Record<string, number> = { employee: 0, user: 1, masteruser: 2 };

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Usage: node <bundle> <file.json> [--apply]");

  const source = JSON.parse(readFileSync(file, "utf8")) as SourceRow[];
  if (!Array.isArray(source)) throw new Error("Expected a JSON array of employees.");

  // De-duplicate by Employee Id; when copies differ in role, keep the highest.
  const byCode = new Map<string, SourceRow>();
  let duplicates = 0;
  for (const row of source) {
    const code = clean(row["Employee Id"], 30);
    if (!code) continue;
    const seen = byCode.get(key(code));
    if (seen) {
      duplicates += 1;
      const rank = (r: SourceRow) => ROLE_RANK[key(r["User Role"] ?? "")] ?? 0;
      if (rank(row) > rank(seen)) byCode.set(key(code), row);
    } else byCode.set(key(code), row);
  }

  const offices = await db().office.findMany({ select: { id: true, name: true, businessUnitId: true } });
  const officeByName = new Map(offices.map((o) => [key(o.name), o]));
  const existing = await db().employee.findMany({ select: { employeeCode: true, office: { select: { businessUnitId: true } } } });
  const taken = new Set(existing.map((e) => `${e.office.businessUnitId}|${key(e.employeeCode)}`));

  const skipped: string[] = [];
  const errors: string[] = [];
  const missingOffices = new Map<string, number>();
  let created = 0;
  let salaries = 0;

  for (const row of byCode.values()) {
    const code = clean(row["Employee Id"], 30)!;
    const name = clean(row["Employee Name"], 150) ?? code;
    const label = `${code} (${name})`;
    try {
      const officeName = clean(row["Office Name"], 150) ?? "";
      const office = officeByName.get(key(officeName));
      if (!office) {
        missingOffices.set(officeName || "(blank)", (missingOffices.get(officeName || "(blank)") ?? 0) + 1);
        throw new Error(`office "${officeName}" not found`);
      }
      const codeKey = `${office.businessUnitId}|${key(code)}`;
      if (taken.has(codeKey)) {
        skipped.push(label);
        continue;
      }
      const joining = clean(row["Joining Date"], 10);
      if (!joining || !ISO_DATE.test(joining)) throw new Error(`invalid joining date "${row["Joining Date"]}"`);

      const role = key(row["User Role"] ?? "");
      const type = clean(row.Type, 50);
      const salary = Number(row.Salary ?? 0);
      const hasSalary = Number.isFinite(salary) && salary > 0;
      taken.add(codeKey);
      if (apply) await db().$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            officeId: office.id,
            employeeCode: code,
            attendanceId: clean(row["Attendance Id"], 30) ?? null,
            name,
            designation: clean(row.Designation, 100) ?? null,
            department: clean(row.Department, 100) ?? null,
            employeeType: type ?? null,
            joiningDate: new Date(joining),
            mobile: clean(row["Mobile/User"], 30) ?? null,
            isUser: role === "user" || role === "masteruser",
            isMasterUser: role === "masteruser",
            isActive: key(row.Status ?? "active") === "active",
          },
          select: { id: true },
        });
        if (hasSalary) {
          await tx.employeeSalary.create({
            data: {
              employeeId: employee.id,
              salaryType: key(type ?? "") === "day basis" ? "day-basis" : "regular",
              salaryOption: "gross",
              grossOnly: salary,
              disbursementMode: "cash",
            },
          });
        }
      });
      created += 1;
      if (hasSalary) salaries += 1;
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(apply ? "\n=== APPLIED ===" : "\n=== DRY RUN (no changes; pass --apply to write) ===");
  console.log(`Rows in file:           ${source.length}`);
  console.log(`Duplicate rows in file: ${duplicates}`);
  console.log(`Unique employees:       ${byCode.size}`);
  console.log(`${apply ? "Created" : "Would create"}:           ${created} (${salaries} with salary)`);
  console.log(`Skipped (already exist): ${skipped.length}`);
  console.log(`Errors:                 ${errors.length}`);
  if (missingOffices.size > 0) console.log("Offices not found:", Object.fromEntries(missingOffices));
  if (errors.length > 0) console.log("\nErrors:\n  " + errors.join("\n  "));
  if (skipped.length > 0) console.log("\nSkipped:\n  " + skipped.join("\n  "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
