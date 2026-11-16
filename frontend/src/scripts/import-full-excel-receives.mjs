import ExcelJS from "../../node_modules/exceljs/dist/es5/index.js";
import pg from "../../node_modules/pg/lib/index.js";
import { randomUUID } from "node:crypto";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  console.log("Reading Excel from: c:/Users/User/Downloads/Purchase Receive.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("c:/Users/User/Downloads/Purchase Receive.xlsx");
  const sheet = wb.getWorksheet("Purchase Receive");

  if (!sheet) {
    throw new Error("Could not find worksheet 'Purchase Receive'");
  }

  // Load master references from pool before taking transaction client
  const officesRes = await pool.query('SELECT id, name, "businessUnitId" FROM offices');
  const warehousesRes = await pool.query('SELECT id, name, "officeId" FROM warehouses');
  const suppliersRes = await pool.query('SELECT id, name, code, "businessUnitId" FROM suppliers');
  const defaultBuRes = await pool.query('SELECT id FROM business_units LIMIT 1');
  const posRes = await pool.query(`
    SELECT po.id, po.number, po."businessUnitId", po."officeId", po."warehouseId", po."supplierId", po.status,
           pol.id as "lineId", pol."itemId", pol."itemCode", pol."itemName", pol.uom, pol.quantity, pol."receivedQuantity", pol."unitPrice"
    FROM purchase_orders po
    LEFT JOIN purchase_order_lines pol ON pol."orderId" = po.id
  `);

  const defaultBuId = defaultBuRes.rows[0]?.id || officesRes.rows[0]?.businessUnitId;
  const officeMap = new Map();
  for (const o of officesRes.rows) {
    officeMap.set(o.name.trim().toLowerCase(), o);
  }

  const whMap = new Map();
  for (const w of warehousesRes.rows) {
    whMap.set(w.name.trim().toLowerCase(), w);
  }

  const supplierMap = new Map();
  for (const s of suppliersRes.rows) {
    supplierMap.set(s.name.trim().toLowerCase(), s);
    const clean = s.name.replace(/^SUP-[A-Z0-9]+\s*-\s*/i, "").replace(/\s*\(\d+\)$/, "").trim().toLowerCase();
    supplierMap.set(clean, s);
  }

  const poMap = new Map();
  for (const p of posRes.rows) {
    if (!poMap.has(p.number)) {
      poMap.set(p.number, {
        id: p.id,
        number: p.number,
        businessUnitId: p.businessUnitId,
        officeId: p.officeId,
        warehouseId: p.warehouseId,
        supplierId: p.supplierId,
        status: p.status,
        lines: [],
      });
    }
    if (p.lineId) {
      poMap.get(p.number).lines.push(p);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Function to ensure supplier exists
    async function getOrCreateSupplier(rawName) {
      const name = (rawName || "").trim();
      if (!name) return suppliersRes.rows[0].id;

      const clean = name.replace(/^SUP-[A-Z0-9]+\s*-\s*/i, "").replace(/\s*\(\d+\)$/, "").trim();
      const existing = supplierMap.get(name.toLowerCase()) || supplierMap.get(clean.toLowerCase());
      if (existing) return existing.id;

      const newId = randomUUID();
      const code = `SUP-AUTO-${randomUUID().slice(0, 6).toUpperCase()}`;
      await client.query(`
        INSERT INTO suppliers (id, "businessUnitId", code, name, status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
      `, [newId, defaultBuId, code, clean]);

      const created = { id: newId, name: clean, code, businessUnitId: defaultBuId };
      supplierMap.set(name.toLowerCase(), created);
      supplierMap.set(clean.toLowerCase(), created);
      console.log(`Created missing supplier: [${clean}] -> ${newId}`);
      return newId;
    }

    let importedCount = 0;
    let directPoCount = 0;
    const poReceivedTotals = new Map(); // poId -> total received qty

    for (let r = 6; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const grnNumber = row.getCell(5).text?.trim() || String(row.getCell(5).value || "").trim();
      if (!grnNumber) continue;

      const recDateVal = row.getCell(2).value;
      let recDateStr = "";
      if (recDateVal instanceof Date) {
        recDateStr = recDateVal.toISOString().slice(0, 10);
      } else if (typeof recDateVal === "number") {
        const d = new Date(Math.round((recDateVal - 25569) * 86400 * 1000));
        recDateStr = d.toISOString().slice(0, 10);
      } else {
        recDateStr = String(recDateVal || "").trim();
      }

      const officeName = row.getCell(3).text?.trim() || String(row.getCell(3).value || "").trim();
      const poNo = row.getCell(4).text?.trim() || String(row.getCell(4).value || "").trim();
      const challanNo = row.getCell(6).text?.trim() || String(row.getCell(6).value || "").trim();
      const salesInvNo = row.getCell(9).text?.trim() || String(row.getCell(9).value || "").trim();
      const whName = row.getCell(11).text?.trim() || String(row.getCell(11).value || "").trim();
      const suppName = row.getCell(12).text?.trim() || String(row.getCell(12).value || "").trim();
      const qty = Math.max(0, Number(row.getCell(13).value || 0));
      const totalBdt = Math.max(0, Number(row.getCell(14).value || 0));
      const preparedBy = row.getCell(16).text?.trim() || String(row.getCell(16).value || "Store Officer").trim();

      const office = officeMap.get(officeName.toLowerCase()) || officesRes.rows[0];
      const businessUnitId = office.businessUnitId || defaultBuId;
      const warehouse = whName ? whMap.get(whName.toLowerCase()) : null;
      const warehouseId = warehouse?.id || null;
      const supplierId = await getOrCreateSupplier(suppName);

      let orderId = null;
      let poLine = null;

      if (poNo && poMap.has(poNo)) {
        const po = poMap.get(poNo);
        orderId = po.id;
        poLine = po.lines[0] || null;

        const prevTot = poReceivedTotals.get(po.id) || 0;
        poReceivedTotals.set(po.id, prevTot + qty);
      } else {
        // Direct Receive: create a direct PO
        orderId = randomUUID();
        const directPoNumber = `DIR-${grnNumber}`;
        const unitPrice = qty > 0 ? (totalBdt / qty) : 0;

        await client.query(`
          INSERT INTO purchase_orders (
            id, "businessUnitId", "officeId", "warehouseId", "supplierId", number,
            "orderDate", "expectedDeliveryDate", status, "subtotal", "totalDiscount",
            "totalTax", "totalAmount", "shippingFee", "notes", "createdBy", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7::date, $7::date, 'RECEIVED', $8, 0,
            0, $8, 0, $9, $10, NOW(), NOW()
          )
          ON CONFLICT ("businessUnitId", number) DO NOTHING
        `, [
          orderId, businessUnitId, office.id, warehouseId, supplierId, directPoNumber,
          recDateStr, totalBdt,
          challanNo ? `Direct receive without PO | Challan: ${challanNo}` : "Direct receive without PO",
          preparedBy
        ]);

        const directPoLineId = randomUUID();
        await client.query(`
          INSERT INTO purchase_order_lines (
            id, "orderId", "lineNo", "itemId", "itemCode", "itemName", uom,
            quantity, "receivedQuantity", "unitPrice", "discountPercent", "vatPercent",
            "lineTotal", "remarks"
          ) VALUES (
            $1, $2, 1, NULL, 'DIR-ITEM', 'Direct Received Materials', 'PCS',
            $3, $3, $4, 0, 0,
            $5, 'Direct Receive'
          )
          ON CONFLICT ("orderId", "lineNo") DO NOTHING
        `, [
          directPoLineId, orderId, qty, unitPrice, totalBdt
        ]);

        directPoCount++;
      }

      // Insert Goods Receipt
      const grnId = randomUUID();
      await client.query(`
        INSERT INTO goods_receipts (
          id, "businessUnitId", "officeId", "warehouseId", "orderId", "supplierId",
          number, "challanNumber", "supplierInvoiceNumber", "receiveDate", status,
          "totalReceivedQty", "totalAcceptedQty", "totalRejectedQty", "totalAmount",
          "receivedBy", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10::date, 'RECEIVED',
          $11, $11, 0, $12,
          $13, NOW(), NOW()
        )
        ON CONFLICT ("businessUnitId", number) DO UPDATE SET
          "challanNumber" = EXCLUDED."challanNumber",
          "supplierInvoiceNumber" = EXCLUDED."supplierInvoiceNumber",
          "totalReceivedQty" = EXCLUDED."totalReceivedQty",
          "totalAcceptedQty" = EXCLUDED."totalAcceptedQty",
          "totalAmount" = EXCLUDED."totalAmount",
          "updatedAt" = NOW()
      `, [
        grnId, businessUnitId, office.id, warehouseId, orderId, supplierId,
        grnNumber, challanNo || null, salesInvNo || null, recDateStr,
        qty, totalBdt, preparedBy
      ]);

      // Insert Goods Receipt Line
      const grnLineId = randomUUID();
      const itemCode = poLine?.itemCode || 'GEN-MAT';
      const itemName = poLine?.itemName || 'Received Purchase Materials';
      const uom = poLine?.uom || 'PCS';
      const unitPrice = qty > 0 ? (totalBdt / qty) : (poLine ? Number(poLine.unitPrice) : 0);

      await client.query(`
        INSERT INTO goods_receipt_lines (
          id, "receiptId", "lineNo", "itemId", "itemCode", "itemName", uom,
          "orderedQty", "receivedQty", "acceptedQty", "rejectedQty", "unitPrice", "lineTotal"
        ) VALUES (
          $1, $2, 1, $3, $4, $5, $6,
          $7, $8, $8, 0, $9, $10
        )
        ON CONFLICT ("receiptId", "lineNo") DO NOTHING
      `, [
        grnLineId, grnId, poLine?.itemId || null, itemCode, itemName, uom,
        poLine ? Number(poLine.quantity) : qty, qty, unitPrice, totalBdt
      ]);

      importedCount++;
    }

    // Update PO lines and PO statuses based on accumulated received quantities
    console.log("Updating PO lines and PO statuses...");
    for (const [poId, totalReceived] of poReceivedTotals.entries()) {
      await client.query(`
        UPDATE purchase_order_lines
        SET "receivedQuantity" = $1
        WHERE "orderId" = $2
      `, [totalReceived, poId]);

      // If fully received or partially received, update PO status
      await client.query(`
        UPDATE purchase_orders
        SET status = CASE
          WHEN $1 >= "totalAmount" OR $1 >= (SELECT COALESCE(SUM(quantity), 0) FROM purchase_order_lines WHERE "orderId" = $2) THEN 'RECEIVED'::"PurchaseOrderStatus"
          WHEN $1 > 0 THEN 'PARTIAL_RECEIVED'::"PurchaseOrderStatus"
          ELSE status
        END
        WHERE id = $2
      `, [totalReceived, poId]);
    }

    await client.query("COMMIT");

    console.log(`\nImport completed successfully!`);
    console.log(`- Total Goods Receipts imported: ${importedCount}`);
    console.log(`- Direct POs generated: ${directPoCount}`);
    console.log(`- POs with updated receive status: ${poReceivedTotals.size}`);

    // Verify DB counts
    const finalGrns = await client.query('SELECT count(*) FROM goods_receipts');
    const finalGrnLines = await client.query('SELECT count(*) FROM goods_receipt_lines');
    const finalPos = await client.query('SELECT status, count(*) FROM purchase_orders GROUP BY status');

    console.log(`\nFinal counts in database:`);
    console.log(`- goods_receipts: ${finalGrns.rows[0].count}`);
    console.log(`- goods_receipt_lines: ${finalGrnLines.rows[0].count}`);
    console.log(`- purchase_orders by status:`, finalPos.rows);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import failed, rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
