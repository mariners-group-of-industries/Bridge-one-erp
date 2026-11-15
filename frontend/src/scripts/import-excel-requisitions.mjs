import ExcelJS from "exceljs";
import pg from "pg";

const { Client } = pg;
const EXCEL_PATH = "C:\\Users\\User\\Downloads\\Purchase Requisition.xlsx";

function parseDateStr(rawDate) {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  if (typeof rawDate === "string") {
    const s = rawDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // If DD-MM-YYYY
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

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  await client.connect();

  console.log("Connected to DB. Loading master data...");
  const buRes = await client.query('SELECT id, name FROM "business_units" LIMIT 1');
  const businessUnitId = buRes.rows[0].id;

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

  // Load Excel
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const worksheet = workbook.worksheets[0];
  console.log(`Loaded sheet: ${worksheet.name}, total rows: ${worksheet.rowCount}`);

  let insertedCount = 0;

  for (let rowNumber = 6; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const requestCode = String(row.getCell(1).value || "").trim();
    if (!requestCode || !requestCode.startsWith("PR-")) continue;

    const rawDate = row.getCell(2).value;
    const dateStr = parseDateStr(rawDate);

    const officeName = String(row.getCell(3).value || "").trim();
    const warehouseName = String(row.getCell(4).value || "").trim();
    const requestType = String(row.getCell(5).value || "LOCAL").trim();
    const dept = String(row.getCell(6).value || "Operations").trim();
    const section = String(row.getCell(7).value || "").trim();
    const buyerName = String(row.getCell(8).value || "").trim();
    const method = String(row.getCell(10).value || "DIRECT").trim();
    const rawBudget = row.getCell(11).value;
    const budget = Number(rawBudget || 0);
    const createdBy = String(row.getCell(12).value || "System User").trim();
    const statusRaw = String(row.getCell(13).value || "PENDING").trim().toLowerCase();
    const remarks = String(row.getCell(14).value || "").trim();

    // Map status
    let status = "PENDING";
    if (statusRaw.includes("approved")) {
      status = "APPROVED";
    } else if (statusRaw.includes("closed") || statusRaw.includes("cancelled")) {
      status = "CANCELLED";
    } else if (statusRaw.includes("rejected")) {
      status = "REJECTED";
    }

    // Resolve officeId
    let officeId = officeMap.get(officeName.toLowerCase());
    if (!officeId) {
      officeId = officeMap.get("mg sirajganj factory") || officesRes.rows[0].id;
    }

    // Resolve warehouseId
    let warehouseId = whMap.get(warehouseName.toLowerCase());
    if (!warehouseId) {
      warehouseId = whMap.get("material wh") || whRes.rows[0]?.id || null;
    }

    const notes = [remarks, section ? `Section: ${section}` : "", buyerName ? `Buyer: ${buyerName}` : ""]
      .filter(Boolean)
      .join(" | ");

    const upsertReqSql = `
      INSERT INTO "purchase_requisitions" (
        "id", "businessUnitId", "officeId", "warehouseId", "number",
        "department", "requestedBy", "requisitionDate", "requiredDate",
        "status", "priority", "requestType", "purchaseMethod",
        "totalEstimated", "notes", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7::date, $7::date,
        $8, 'MEDIUM', $9, $10,
        $11, $12, NOW(), NOW()
      )
      ON CONFLICT ("businessUnitId", "number") DO UPDATE SET
        "officeId" = EXCLUDED."officeId",
        "warehouseId" = EXCLUDED."warehouseId",
        "department" = EXCLUDED."department",
        "requestedBy" = EXCLUDED."requestedBy",
        "requisitionDate" = EXCLUDED."requisitionDate",
        "requiredDate" = EXCLUDED."requiredDate",
        "status" = EXCLUDED."status",
        "totalEstimated" = EXCLUDED."totalEstimated",
        "notes" = EXCLUDED."notes",
        "updatedAt" = NOW()
      RETURNING "id";
    `;

    const reqRes = await client.query(upsertReqSql, [
      businessUnitId,
      officeId,
      warehouseId,
      requestCode,
      dept,
      createdBy,
      dateStr,
      status,
      requestType,
      method,
      budget,
      notes || null,
    ]);

    const reqId = reqRes.rows[0].id;

    // Delete existing lines and re-insert line 1
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
      [reqId, requestCode, remarks || `PR Item for ${requestCode}`, budget, remarks || null]
    );

    insertedCount++;
  }

  console.log(`\nDONE! Successfully updated ${insertedCount} requisitions with exact dates.`);
  await client.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
