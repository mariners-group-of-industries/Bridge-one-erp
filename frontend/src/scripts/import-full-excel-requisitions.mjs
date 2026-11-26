import ExcelJS from "../../node_modules/exceljs/dist/es5/index.js";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "frontend/.env" });
dotenv.config({ path: "frontend/.env.development" });

const { Client } = pg;
const EXCEL_PATH = "c:/Users/User/Downloads/Purchase Requisition (1).xlsx";

function parseDateStr(rawDate) {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  if (typeof rawDate === "string") {
    const s = rawDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dmy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    return s.slice(0, 10);
  }
  if (rawDate instanceof Date) {
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, "0");
    const d = String(rawDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  await client.connect();

  console.log("Connected to database.");

  // 1. Remove all fake / dummy requisitions and any child lines
  console.log("Removing all fake / dummy requisitions...");
  const fakeDelRes = await client.query(`
    DELETE FROM "purchase_requisitions"
    WHERE "number" NOT LIKE 'PR-%'
       OR "number" IN ('REQ-2026-00103', 'REQ-2026-00002', 'REQ-2026-00001')
    RETURNING "number";
  `);
  console.log(`Deleted ${fakeDelRes.rowCount} fake requisitions:`, fakeDelRes.rows.map(r => r.number));

  // 2. Fetch master data
  const buRes = await client.query('SELECT id, name FROM "business_units" LIMIT 1');
  const businessUnitId = buRes.rows[0].id;
  console.log("Using businessUnitId:", businessUnitId);

  const officesRes = await client.query('SELECT id, name FROM "offices" WHERE "businessUnitId" = $1', [businessUnitId]);
  const officeMap = new Map();
  for (const o of officesRes.rows) {
    officeMap.set(o.name.trim().toLowerCase(), o.id);
  }

  const whRes = await client.query('SELECT id, name, "officeId" FROM "warehouses"');
  const whMap = new Map();
  for (const w of whRes.rows) {
    whMap.set(w.name.trim().toLowerCase(), w.id);
  }

  // 3. Load Excel workbook
  console.log(`Reading Excel file: ${EXCEL_PATH}...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const ws = wb.worksheets[0];
  console.log(`Loaded sheet "${ws.name}", total rows: ${ws.rowCount}`);

  let importedCount = 0;

  for (let r = 6; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const requestCode = String(row.getCell(1).value || "").trim();
    if (!requestCode || !requestCode.startsWith("PR-")) continue;

    const rawDate = row.getCell(2).value;
    const dateStr = parseDateStr(rawDate);

    const officeName = String(row.getCell(3).value || "").trim();
    const warehouseName = String(row.getCell(4).value || "").trim();
    const requestTypeRaw = String(row.getCell(5).value || "department").trim();
    const empDeptSection = String(row.getCell(6).value || "Operations").trim();
    const section = String(row.getCell(7).value || "").trim();
    const buyerName = String(row.getCell(8).value || "").trim();
    const buyerOffice = String(row.getCell(9).value || "").trim();
    const method = String(row.getCell(10).value || "Purchase Order Method").trim();
    const rawBudget = row.getCell(11).value;
    const budget = Number(rawBudget || 0);
    const createdBy = String(row.getCell(12).value || "MD.MOSHIUR RAHMAN").trim();
    const statusRaw = String(row.getCell(13).value || "Pending").trim().toLowerCase();
    const remarks = String(row.getCell(14).value || "").trim();

    // Map status enum: DRAFT, PENDING, APPROVED, REJECTED, ORDERED, CANCELLED
    let status = "PENDING";
    if (statusRaw.includes("approved")) {
      status = "APPROVED";
    } else if (statusRaw.includes("closed") || statusRaw.includes("cancelled")) {
      status = "CANCELLED";
    } else if (statusRaw.includes("order")) {
      status = "ORDERED";
    } else if (statusRaw.includes("reject")) {
      status = "REJECTED";
    }

    // Resolve office
    let officeId = officeMap.get(officeName.toLowerCase());
    if (!officeId) {
      officeId = officeMap.get("mg sirajganj factory") || officesRes.rows[0].id;
    }

    // Resolve warehouse
    let warehouseId = whMap.get(warehouseName.toLowerCase());
    if (!warehouseId && warehouseName) {
      warehouseId = whMap.get("material wh") || null;
    }

    // Determine department and requestedBy
    let department = empDeptSection;
    let requestedBy = createdBy;
    if (requestTypeRaw.toLowerCase() === "employee") {
      requestedBy = empDeptSection;
      department = "Operations";
    }

    // Build structured notes
    const notesParts = [
      remarks,
      section ? `Section: ${section}` : "",
      buyerName ? `Buyer: ${buyerName}` : "",
      buyerOffice ? `Buyer Office: ${buyerOffice}` : "",
    ].filter(Boolean);
    const notes = notesParts.join(" | ");

    // Upsert into purchase_requisitions
    const upsertSql = `
      INSERT INTO "purchase_requisitions" (
        "id", "businessUnitId", "officeId", "warehouseId", "number",
        "department", "requestedBy", "requisitionDate", "requiredDate",
        "status", "priority", "requestType", "purchaseMethod",
        "totalEstimated", "notes", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7::date, $7::date,
        $8, 'MEDIUM', $9, $10,
        $11, $12, ($7::date + time '12:00:00'), ($7::date + time '12:00:00')
      )
      ON CONFLICT ("businessUnitId", "number") DO UPDATE SET
        "officeId" = EXCLUDED."officeId",
        "warehouseId" = EXCLUDED."warehouseId",
        "department" = EXCLUDED."department",
        "requestedBy" = EXCLUDED."requestedBy",
        "requisitionDate" = EXCLUDED."requisitionDate",
        "requiredDate" = EXCLUDED."requiredDate",
        "status" = EXCLUDED."status",
        "requestType" = EXCLUDED."requestType",
        "purchaseMethod" = EXCLUDED."purchaseMethod",
        "totalEstimated" = EXCLUDED."totalEstimated",
        "notes" = EXCLUDED."notes",
        "createdAt" = EXCLUDED."createdAt",
        "updatedAt" = NOW()
      RETURNING "id";
    `;

    const res = await client.query(upsertSql, [
      businessUnitId,
      officeId,
      warehouseId || null,
      requestCode,
      department,
      requestedBy,
      dateStr,
      status,
      requestTypeRaw,
      method,
      budget,
      notes || null,
    ]);

    const reqId = res.rows[0].id;

    // Refresh requisition line item
    await client.query('DELETE FROM "purchase_requisition_lines" WHERE "requisitionId" = $1', [reqId]);
    await client.query(
      `
      INSERT INTO "purchase_requisition_lines" (
        "id", "requisitionId", "lineNo", "itemCode", "itemName",
        "uom", "quantity", "estimatedUnitPrice", "lineTotal", "remarks"
      ) VALUES (
        gen_random_uuid(), $1, 1, $2, $3,
        'Pcs', 1, $4, $4, $5
      )
    `,
      [reqId, requestCode, remarks || `Item for ${requestCode}`, budget, remarks || null]
    );

    importedCount++;
  }

  console.log(`\nSuccessfully imported/updated ${importedCount} requisitions from Excel.`);

  // Verify final count
  const finalCheck = await client.query(`
    SELECT count(*) as total,
           count(CASE WHEN "number" NOT LIKE 'PR-%' THEN 1 END) as fake_count
    FROM "purchase_requisitions"
  `);
  console.log("Database verification:", finalCheck.rows[0]);

  await client.end();
}

run().catch((err) => {
  console.error("Import error:", err);
  process.exit(1);
});
