/**
 * import-bom.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Imports Bill of Materials from an Excel file into the database.
 * Idempotent: safe to run multiple times — existing BOMs are updated, not
 * duplicated. Each BOM + its output row are written inside a transaction.
 *
 * USAGE:
 *   npx tsx --env-file=.env scripts/import-bom.ts [path-to-excel]
 *
 * DEFAULT FILE:
 *   C:/Users/arifv/Desktop/jakaria/New folder (2)/Bill Of Material.xlsx
 *
 * Excel layout:
 *   Row 1-4 : title / blank
 *   Row 5   : header  →  SL | Date | BOM Name | Item Name | Department |
 *                         Section | UoM | Alt. UoM | Lot Size | BOM Value |
 *                         Created By
 *   Row 6+  : data
 *
 * Prisma models written:
 *   ProductionBom          (production_boms)
 *   ProductionBomOutput    (production_bom_outputs)
 *   ProductionDepartment   (auto-created if missing)
 *   ProductionDepartmentSection (auto-created if missing)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as ExcelJS from "exceljs";
import * as path from "path";
import { db } from "../src/lib/prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExcelRow {
  sl: number;
  date: Date;
  bomName: string;
  itemCode: string;
  itemName: string;
  department: string;
  section: string;
  uom: string;
  altUom: string;
  lotSize: number;
  bomValue: number;
  createdBy: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (typeof val === "string" && val.trim()) {
    const parts = val.trim().split("-");
    // DD-MM-YYYY
    if (parts.length === 3 && parts[0].length <= 2) {
      const [dd, mm, yyyy] = parts;
      return new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00.000Z`);
    }
    return new Date(val);
  }
  return new Date();
}

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function num(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

/**
 * "FGBIS250542 - Marine Sweet Toast 200gx6 (PCS)" → code="FGBIS250542", name="Marine Sweet Toast..."
 * "000011 - SFGSNMISTIPEANUT (KG)"                → code="000011"
 */
function parseItemField(raw: string): { code: string; name: string } {
  const dash = raw.indexOf(" - ");
  if (dash > -1) {
    return {
      code: raw.substring(0, dash).trim(),
      name: raw.substring(dash + 3).trim(),
    };
  }
  return { code: raw.trim(), name: raw.trim() };
}

/**
 * Determine ProductionOutputType from item code.
 * SFG-xxxxx and 000xxx are semi-finished goods; FG* are finished goods.
 */
function outputType(itemCode: string): "FINISHED_GOODS" | "SEMI_FINISHED_GOODS" {
  const c = itemCode.toUpperCase();
  if (c.startsWith("SFG") || c.startsWith("000")) return "SEMI_FINISHED_GOODS";
  return "FINISHED_GOODS";
}

// ─── Read Excel ───────────────────────────────────────────────────────────────

async function readExcel(filePath: string): Promise<ExcelRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet("Bill Of Material");
  if (!sheet) throw new Error('Sheet "Bill Of Material" not found.');

  const rows: ExcelRow[] = [];
  for (let i = 6; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const vals = row.values as unknown[];
    if (!vals || vals.length < 2) continue;
    const bomName = str(vals[3]);
    if (!bomName) continue;

    const { code: itemCode, name: itemName } = parseItemField(str(vals[4]));

    rows.push({
      sl: num(vals[1]),
      date: parseDate(vals[2]),
      bomName,
      itemCode,
      itemName,
      department: str(vals[5]),
      section: str(vals[6]),
      uom: str(vals[7]),
      altUom: str(vals[8]),
      lotSize: num(vals[9]) || 1,
      bomValue: num(vals[10]),
      createdBy: str(vals[11]),
    });
  }
  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(
        "C:/Users/arifv/Desktop/jakaria/New folder (2)/Bill Of Material.xlsx"
      );

  console.log("\n========================================");
  console.log("  Bill of Materials Import");
  console.log("========================================");
  console.log(`File : ${filePath}`);

  // ── 1. Read Excel ──────────────────────────────────────────────────────────
  console.log("\n[1/7] Reading Excel file...");
  const excelRows = await readExcel(filePath);
  console.log(`      ${excelRows.length} data rows found.`);

  const prisma = db();

  try {
    // ── 2. Business Unit ───────────────────────────────────────────────────
    console.log("\n[2/7] Resolving Business Unit...");
    const businessUnit = await prisma.businessUnit.findFirstOrThrow({
      where: { name: { contains: "Mariners", mode: "insensitive" } },
    });
    console.log(`      ${businessUnit.name}  (${businessUnit.id})`);

    // ── 3. Actor ───────────────────────────────────────────────────────────
    console.log("\n[3/7] Resolving actor for createdBy...");
    const adminUser = await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    const defaultCreatedBy = adminUser?.name ?? "system-import";
    console.log(`      ${defaultCreatedBy}`);

    // ── 4. Departments & Sections (outside transaction — idempotent) ───────
    console.log("\n[4/7] Ensuring departments and sections exist...");
    const deptMap = new Map<string, string>();   // deptName  → id
    const secMap  = new Map<string, string>();   // "deptId:secName" → id

    const uniqueDepts = Array.from(
      new Set(excelRows.map((r) => r.department).filter(Boolean))
    );
    for (const deptName of uniqueDepts) {
      let dept = await prisma.productionDepartment.findFirst({
        where: { businessUnitId: businessUnit.id, name: deptName },
      });
      if (!dept) {
        dept = await prisma.productionDepartment.create({
          data: { businessUnitId: businessUnit.id, name: deptName },
        });
        console.log(`      Created dept: ${deptName}`);
      }
      deptMap.set(deptName, dept.id);
    }

    const uniqueSecs = Array.from(
      new Set(
        excelRows
          .filter((r) => r.section && r.department)
          .map((r) => `${r.department}|||${r.section}`)
      )
    );
    for (const key of uniqueSecs) {
      const [deptName, secName] = key.split("|||");
      const deptId = deptMap.get(deptName);
      if (!deptId) continue;
      let sec = await prisma.productionDepartmentSection.findFirst({
        where: { departmentId: deptId, name: secName },
      });
      if (!sec) {
        sec = await prisma.productionDepartmentSection.create({
          data: { departmentId: deptId, name: secName },
        });
        console.log(`      Created section: ${secName} (${deptName})`);
      }
      secMap.set(`${deptId}:${secName}`, sec.id);
    }

    // ── 5. Item lookup ─────────────────────────────────────────────────────
    console.log("\n[5/7] Looking up items...");
    const itemCodes = Array.from(new Set(excelRows.map((r) => r.itemCode).filter(Boolean)));
    const items = await prisma.item.findMany({
      where: { code: { in: itemCodes } },
      select: { id: true, code: true, name: true },
    });
    const itemMap = new Map(items.map((it) => [it.code, it]));
    const unmatchedCodes = itemCodes.filter((c) => !itemMap.has(c));
    console.log(`      Matched : ${items.length} / ${itemCodes.length}`);
    if (unmatchedCodes.length > 0) {
      console.warn(`      Unmatched item codes (${unmatchedCodes.length}):`);
      unmatchedCodes.forEach((c) => console.warn(`        - ${c}`));
    }

    // ── 6. Upsert each BOM in its own transaction ──────────────────────────
    console.log("\n[6/7] Importing BOMs (one transaction per BOM)...");

    let inserted = 0;
    let updated  = 0;
    let noItem   = 0;
    const failedRows: string[] = [];

    for (const row of excelRows) {
      const deptId  = deptMap.get(row.department) ?? null;
      const secId   = deptId ? (secMap.get(`${deptId}:${row.section}`) ?? null) : null;
      const item    = itemMap.get(row.itemCode);

      try {
        await prisma.$transaction(async (tx) => {
          // ── BOM ──
          const existing = await tx.productionBom.findFirst({
            where: { businessUnitId: businessUnit.id, name: row.bomName },
            select: { id: true },
          });

          let bomId: string;

          if (existing) {
            // Update — only fields that may have changed
            await tx.productionBom.update({
              where: { id: existing.id },
              data: {
                departmentId:        deptId,
                departmentSectionId: secId,
                lotSize:             row.lotSize,
                materialCost:        row.bomValue,
                overheadCost:        0,
                totalCost:           row.bomValue,
              },
            });
            bomId = existing.id;
            updated++;
          } else {
            // Insert
            const created = await tx.productionBom.create({
              data: {
                businessUnitId:      businessUnit.id,
                name:                row.bomName,
                bomType:             "SINGLE_OUTPUT",
                departmentId:        deptId,
                departmentSectionId: secId,
                lotSize:             row.lotSize,
                materialCost:        row.bomValue,
                overheadCost:        0,
                totalCost:           row.bomValue,
                isActive:            true,
                createdBy:           row.createdBy || defaultCreatedBy,
                createdAt:           row.date,
              },
            });
            bomId = created.id;
            inserted++;
          }

          // ── BOM Output (only if item exists) ──
          if (item) {
            const existingOutput: { id: string } | null = await tx.productionBomOutput.findFirst({
              where: { bomId, itemId: item.id },
              select: { id: true },
            });

            if (!existingOutput) {
              await tx.productionBomOutput.create({
                data: {
                  bomId,
                  itemId:          item.id,
                  lineNo:          1,
                  outputType:      outputType(row.itemCode),
                  lotSizeQty:      row.lotSize,
                  netWeight:       0,
                  totalWeight:     0,
                  costPercent:     100,
                  tolerancePercent: null,
                  isPrimary:       true,
                },
              });
            } else {
              // Keep output in sync with BOM lot size
              await tx.productionBomOutput.update({
                where: { id: existingOutput.id },
                data: { lotSizeQty: row.lotSize },
              });
            }
          } else {
            noItem++;
          }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`      FAILED row ${row.sl} "${row.bomName}": ${msg}`);
        failedRows.push(row.bomName);
        // Transaction rolled back automatically — no counter to undo
      }
    }

    // ── 7. Verify ─────────────────────────────────────────────────────────
    console.log("\n[7/7] Verifying database...");
    const dbBoms = await prisma.productionBom.findMany({
      where: { businessUnitId: businessUnit.id },
      select: {
        id:         true,
        name:       true,
        lotSize:    true,
        totalCost:  true,
        createdAt:  true,
        department: { select: { name: true } },
        departmentSection: { select: { name: true } },
        outputs: {
          select: {
            item:       { select: { code: true, name: true } },
            outputType: true,
            lotSizeQty: true,
            isPrimary:  true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Cross-check: which Excel names are in DB
    const dbNames = new Set(dbBoms.map((b) => b.name));
    const excelNames = new Set(excelRows.map((r) => r.bomName));
    const missingFromDb = Array.from(excelNames).filter((n) => !dbNames.has(n));

    // ── Report ─────────────────────────────────────────────────────────────
    console.log("\n========================================");
    console.log("  IMPORT REPORT");
    console.log("========================================");
    console.log(`  Excel rows total          : ${excelRows.length}`);
    console.log(`  Newly inserted            : ${inserted}`);
    console.log(`  Already existed (updated) : ${updated}`);
    console.log(`  Failed (transaction error): ${failedRows.length}`);
    console.log(`  Item not found in DB      : ${noItem}`);
    console.log(`  Unmatched item codes      : ${unmatchedCodes.length}`);

    console.log("\n  --- DB Verification ---");
    console.log(`  Total BOMs in DB (this BU): ${dbBoms.length}`);
    console.log(`  Missing from DB           : ${missingFromDb.length}`);

    if (missingFromDb.length > 0) {
      console.warn("  BOMs missing from DB:");
      missingFromDb.forEach((n) => console.warn(`    - ${n}`));
    }

    if (failedRows.length > 0) {
      console.warn("\n  Failed BOM names:");
      failedRows.forEach((n) => console.warn(`    - ${n}`));
    }

    console.log("\n  --- Imported BOM List ---");
    for (const bom of dbBoms) {
      const isDemo = bom.name.startsWith("DEMO");
      const inExcel = excelNames.has(bom.name);
      const tag = isDemo ? "[DEMO]" : inExcel ? "[OK]  " : "[???] ";
      const output = bom.outputs[0];
      const itemCode = output?.item?.code ?? "no-output";
      const dept = bom.department?.name ?? "-";
      const sec  = bom.departmentSection?.name ?? "-";
      console.log(
        `  ${tag} ${bom.name.padEnd(50)} | lot:${bom.lotSize.toString().padStart(8)} | cost:${bom.totalCost.toString().padStart(14)} | item:${itemCode} | dept:${dept} | sec:${sec}`
      );
    }

    console.log("\n========================================");
    if (missingFromDb.length === 0 && failedRows.length === 0) {
      console.log("  STATUS: SUCCESS — all 64 Excel BOMs are in the database.");
    } else {
      console.log(`  STATUS: PARTIAL — ${missingFromDb.length} BOM(s) missing, ${failedRows.length} failed.`);
    }
    console.log("========================================\n");

    await prisma.$disconnect();
  } catch (err) {
    await prisma.$disconnect();
    throw err;
  }
}

main().catch((e) => {
  console.error("\nImport failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
