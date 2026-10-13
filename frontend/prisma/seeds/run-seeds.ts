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
  const dir = join(import.meta.dirname);
  const sql1 = readFileSync(join(dir, "employees_seed.sql"), "utf8");
  const sql2 = readFileSync(join(dir, "employees_seed_2.sql"), "utf8");

  await prisma.$executeRawUnsafe(sql1);
  console.log("✓ employees_seed.sql applied");

  await prisma.$executeRawUnsafe(sql2);
  console.log("✓ employees_seed_2.sql applied");

  await prisma.$disconnect();
  console.log("✓ Done");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
