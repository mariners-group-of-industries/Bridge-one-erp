import ExcelJS from "../../node_modules/exceljs/dist/es5/index.js";
import pg from "pg";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: "frontend/.env" });
dotenv.config({ path: "frontend/.env.development" });

const { Client } = pg;
const EXCEL_PATH = "c:/Users/User/Downloads/Local PO.xlsx";

function parseDateStr(rawDate) {
  if (!rawDate) return null;
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
  return null;
}

function mapStatus(statusRaw) {
  const s = String(statusRaw || "").trim().toLowerCase();
  if (s.includes("partially")) return "PARTIAL_RECEIVED";
  if (s.includes("complete") || s.includes("received")) return "RECEIVED";
  if (s.includes("cancel")) return "CANCELLED";
  if (s.includes("approved")) return "APPROVED";
  if (s.includes("review")) return "PENDING";
  if (s.includes("pending")) return "PENDING";
  return "PENDING";
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("Reading Excel from:", EXCEL_PATH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.getWorksheet("Local PO");

  // 1. Get business unit
  const buRes = await client.query('SELECT id FROM business_units WHERE name ILIKE $1 LIMIT 1;', ['%Mariners%']);
  const businessUnitId = buRes.rows[0]?.id || 'a77abbea-a4c7-44e4-b49b-7b55071279dc';

  // 2. Map offices
  const officesRes = await client.query('SELECT id, name FROM offices;');
  const officeMap = new Map();
  officesRes.rows.forEach((o) => {
    officeMap.set(o.name.trim().toLowerCase(), o.id);
  });

  // 3. Map default warehouses per office
  const whRes = await client.query('SELECT id, name, "officeId" FROM warehouses;');
  const officeWarehouseMap = new Map();
  whRes.rows.forEach((w) => {
    if (!officeWarehouseMap.has(w.officeId)) {
      officeWarehouseMap.set(w.officeId, w.id);
    }
  });

  // 4. Map suppliers & auto-create missing ones
  const suppRes = await client.query('SELECT id, name FROM suppliers;');
  const supplierMap = new Map();
  suppRes.rows.forEach((s) => {
    supplierMap.set(s.name.trim().toLowerCase(), s.id);
  });

  // 5. Map requisitions by number
  const reqRes = await client.query('SELECT id, number FROM purchase_requisitions;');
  const reqMap = new Map();
  reqRes.rows.forEach((r) => {
    reqMap.set(r.number.trim(), r.id);
  });

  // Check and create missing suppliers
  const excelSuppliers = new Set();
  for (let r = 6; r <= sheet.rowCount; r++) {
    const sName = sheet.getRow(r).getCell(8).value;
    if (sName) excelSuppliers.add(String(sName).trim());
  }

  let autoCodeCounter = 100;
  for (const sName of excelSuppliers) {
    const key = sName.toLowerCase();
    if (!supplierMap.has(key)) {
      const suppId = crypto.randomUUID();
      const code = `SUP-AUTO${++autoCodeCounter}`;
      await client.query(
        `INSERT INTO suppliers (
          id, "businessUnitId", code, name, "contactPerson", type, status, balance, "isActive", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, 'LOCAL', 'ACTIVE', 0, true, NOW(), NOW())`,
        [suppId, businessUnitId, code, sName, sName]
      );
      supplierMap.set(key, suppId);
      console.log(`Created missing supplier: [${sName}] -> ${suppId}`);
    }
  }

  // 6. Process all 339 data rows
  let importedCount = 0;
  let updatedCount = 0;

  await client.query("BEGIN");
  try {
    for (let r = 6; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const sl = row.getCell(1).value;
      if (!sl) continue;

      const rawPoDate = row.getCell(2).value;
      const rawReceDate = row.getCell(3).value;
      const refNo = row.getCell(4).value ? String(row.getCell(4).value).trim() : null;
      const officeName = row.getCell(5).value ? String(row.getCell(5).value).trim() : "";
      const poNo = String(row.getCell(6).value || "").trim();
      const projectOutlet = row.getCell(7).value ? String(row.getCell(7).value).trim() : null;
      const supplierName = row.getCell(8).value ? String(row.getCell(8).value).trim() : "";
      const createdBy = row.getCell(9).value ? String(row.getCell(9).value).trim() : "MD. Mizanur Rahman Roton";
      const rawAmount = row.getCell(10).value;
      const eta = row.getCell(11).value ? String(row.getCell(11).value).trim() : null;
      const statusText = row.getCell(12).value ? String(row.getCell(12).value).trim() : "Pending";

      if (!poNo) continue;

      const poDate = parseDateStr(rawPoDate) || new Date().toISOString().slice(0, 10);
      const receDate = parseDateStr(rawReceDate) || poDate;
      const amount = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount || 0));
      const status = mapStatus(statusText);

      // Office
      const officeId = officeMap.get(officeName.toLowerCase()) || officeMap.get("mg sirajganj factory") || officesRes.rows[0]?.id;
      // Warehouse
      const warehouseId = officeWarehouseMap.get(officeId) || null;
      // Supplier
      const supplierId = supplierMap.get(supplierName.toLowerCase()) || supplierMap.get("packfirm limited") || suppRes.rows[0]?.id;
      // Requisition Link
      const requisitionId = refNo && reqMap.has(refNo) ? reqMap.get(refNo) : null;

      const notes = [
        eta ? `ETA: ${eta}` : null,
        projectOutlet ? `Project: ${projectOutlet}` : null,
      ].filter(Boolean).join(" | ") || null;

      // Check existing
      const existing = await client.query(
        'SELECT id FROM purchase_orders WHERE "businessUnitId" = $1 AND number = $2;',
        [businessUnitId, poNo]
      );

      let orderId;
      if (existing.rows.length > 0) {
        orderId = existing.rows[0].id;
        await client.query(
          `UPDATE purchase_orders SET
            "officeId" = $1,
            "warehouseId" = $2,
            "supplierId" = $3,
            "requisitionId" = $4,
            "orderDate" = $5,
            "expectedDeliveryDate" = $6,
            "referenceNumber" = $7,
            "projectCostCenter" = $8,
            status = $9,
            subtotal = $10,
            "totalAmount" = $11,
            notes = $12,
            "createdBy" = $13,
            "updatedAt" = NOW()
          WHERE id = $14;`,
          [
            officeId,
            warehouseId,
            supplierId,
            requisitionId,
            poDate,
            receDate,
            refNo,
            projectOutlet,
            status,
            amount,
            amount,
            notes,
            createdBy,
            orderId,
          ]
        );
        updatedCount++;
      } else {
        orderId = crypto.randomUUID();
        await client.query(
          `INSERT INTO purchase_orders (
            id, "businessUnitId", "officeId", "warehouseId", "supplierId", "requisitionId",
            number, "orderDate", "expectedDeliveryDate", "referenceNumber", "projectCostCenter",
            status, subtotal, "totalDiscount", "totalTax", "shippingFee", "totalAmount",
            notes, "createdBy", "createdAt", "updatedAt", "paymentTerms", "deliveryTerms"
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, 0, 0, 0, $14,
            $15, $16, $17, NOW(), 'Net 30 Days', 'FOB Warehouse'
          );`,
          [
            orderId,
            businessUnitId,
            officeId,
            warehouseId,
            supplierId,
            requisitionId,
            poNo,
            poDate,
            receDate,
            refNo,
            projectOutlet,
            status,
            amount,
            amount,
            notes,
            createdBy,
            new Date(poDate + "T06:00:00Z"),
          ]
        );
        importedCount++;
      }

      // Upsert purchase_order_lines
      const lineExists = await client.query('SELECT id FROM purchase_order_lines WHERE "orderId" = $1 LIMIT 1;', [orderId]);
      const recQty = status === "RECEIVED" ? 1 : status === "PARTIAL_RECEIVED" ? 0.5 : 0;
      if (lineExists.rows.length > 0) {
        await client.query(
          `UPDATE purchase_order_lines SET
            "unitPrice" = $1,
            "lineTotal" = $2,
            "receivedQuantity" = $3
          WHERE id = $4;`,
          [amount, amount, recQty, lineExists.rows[0].id]
        );
      } else {
        const lineId = crypto.randomUUID();
        await client.query(
          `INSERT INTO purchase_order_lines (
            id, "orderId", "lineNo", "itemId", "itemCode", "itemName",
            uom, quantity, "unitPrice", "discountPercent", "vatPercent",
            "lineTotal", "receivedQuantity", remarks
          ) VALUES (
            $1, $2, 1, null, 'GEN-ITEM', 'General Purchase Materials',
            'LOT', 1, $3, 0, 0,
            $4, $5, null
          );`,
          [lineId, orderId, amount, amount, recQty]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`\nTransaction COMMITTED successfully!`);
    console.log(`Imported New: ${importedCount}`);
    console.log(`Updated Existing: ${updatedCount}`);
    console.log(`Total Processed: ${importedCount + updatedCount}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to import orders, rolled back:", err);
    throw err;
  }

  // Verification
  const totalCount = await client.query("SELECT COUNT(*) FROM purchase_orders;");
  const totalLines = await client.query("SELECT COUNT(*) FROM purchase_order_lines;");
  console.log(`\nFinal purchase_orders in DB: ${totalCount.rows[0].count}`);
  console.log(`Final purchase_order_lines in DB: ${totalLines.rows[0].count}`);

  const sampleRecent = await client.query(`
    SELECT number, "orderDate", status, "totalAmount", "createdBy"
    FROM purchase_orders
    ORDER BY "orderDate" DESC, "createdAt" DESC
    LIMIT 5;
  `);
  console.log("\nTop 5 latest POs in DB:");
  sampleRecent.rows.forEach((r) => console.log(r));

  await client.end();
}

main().catch((err) => {
  console.error("Import error:", err);
  process.exit(1);
});
