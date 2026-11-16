import "dotenv/config";
import pg from "pg";
import crypto from "crypto";

const { Client } = pg;

const SO_LINES = [
  { code: "FGBIS250543", name: "Marine Special Toast 200gx6", qty: 72, uom: "PCS" },
  { code: "FGBIS250542", name: "Marine Sweet Toast 200gx6", qty: 60, uom: "PCS" },
  { code: "FGMOIL240318", name: "Marine Mustard Oil 250ml (1x24)", qty: 48, uom: "PCS" },
  { code: "FGMOIL240317", name: "Marine Mustard Oil 80ml (1x48)", qty: 144, uom: "PCS" },
  { code: "FGCHIPS240613", name: "Marine Potato Chips 12gm (20x4)", qty: 1600, uom: "PCS" },
  { code: "FGSN220110", name: "Peawal Bar-B-Q Badam-Chira 25gm (24x12)", qty: 288, uom: "PCS" },
  { code: "FGSN220109", name: "Peawal Badam-Nimki 22gm (24x12)", qty: 2304, uom: "PCS" },
  { code: "FGSN230206", name: "Peawal Jhal Chanachur 22gm (24x12)", qty: 576, uom: "PCS" },
  { code: "FGSN230205", name: "Peawal B-B-Q Chanachur 200gm (6x12)", qty: 72, uom: "PCS" },
  { code: "FGPE220101", name: "Peawal Jhal Badam 18 gm (24x12)", qty: 864, uom: "PCS" },
];

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  await client.connect();

  const soRes = await client.query(
    `SELECT id, number FROM "sales_orders" WHERE number = 'SO-MG261100074' LIMIT 1`
  );

  if (soRes.rows.length === 0) {
    console.log("Sales order SO-MG261100074 not found.");
    await client.end();
    return;
  }

  const so = soRes.rows[0];
  console.log(`Found SO-MG261100074 (ID: ${so.id})`);

  const linesRes = await client.query(
    `SELECT id FROM "sales_order_lines" WHERE "orderId" = $1`,
    [so.id]
  );
  console.log(`Existing lines count: ${linesRes.rows.length}`);

  if (linesRes.rows.length === 0) {
    for (let i = 0; i < SO_LINES.length; i++) {
      const def = SO_LINES[i];
      let itemRes = await client.query(
        `SELECT id, code, name, uom FROM "items" WHERE code = $1 LIMIT 1`,
        [def.code]
      );

      let itemId;
      if (itemRes.rows.length === 0) {
        console.log(`Item with code ${def.code} not found, creating it...`);
        const newItemId = crypto.randomUUID();
        await client.query(
          `INSERT INTO "items" (id, code, name, uom, category, "standardPrice", "purchasePrice", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 'Finished Goods', 0, 0, 'ACTIVE', NOW(), NOW())`,
          [newItemId, def.code, def.name, def.uom]
        );
        itemId = newItemId;
      } else {
        itemId = itemRes.rows[0].id;
      }

      const lineId = crypto.randomUUID();
      await client.query(
        `INSERT INTO "sales_order_lines" (
          id, "orderId", "lineNo", "itemId", uom, qty, "unitPrice",
          "grossAmount", "lineTotal", "baseAmount", "vatAmount", "aitAmount", "discountPercent", "vatPercent", "aitPercent", "deliveredQty"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0
        )`,
        [lineId, so.id, i + 1, itemId, def.uom, def.qty]
      );
      console.log(`Created line ${i + 1} for ${def.code} (${def.qty} ${def.uom})`);
    }
  }

  const finalCheck = await client.query(
    `SELECT count(*) FROM "sales_order_lines" WHERE "orderId" = $1`,
    [so.id]
  );
  console.log(`SO-MG261100074 now has ${finalCheck.rows[0].count} lines.`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
