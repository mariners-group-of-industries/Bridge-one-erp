import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: join(__dirname, "../../.env") });

const sql = readFileSync(
  join(__dirname, "../migrations/20261017000000_add_employee_academic/migration.sql"),
  "utf8",
);

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("✓ employee_academics table created");
}

main().catch((e) => { console.error(e); process.exit(1); });
