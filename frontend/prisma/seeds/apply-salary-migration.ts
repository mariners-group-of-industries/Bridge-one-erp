import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

async function run() {
  const sql = readFileSync(
    join(import.meta.dirname, "../migrations/20261016000000_add_employee_salary/migration.sql"),
    "utf8",
  );
  await prisma.$executeRawUnsafe(sql);
  console.log("✓ employee_salaries + employee_salary_adjustments tables created");
  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
