import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * In-process PostgreSQL (PGlite) with the real Prisma migrations applied, so
 * tests exercise the same constraints, foreign keys and SQL as production.
 */
let current: { pg: PGlite; prisma: PrismaClient } | undefined;

export function testPrisma(): PrismaClient {
  if (!current) throw new Error("Test database not started. Call startTestDb() in beforeAll.");
  return current.prisma;
}

export async function startTestDb(): Promise<PrismaClient> {
  const pg = new PGlite();
  const migrationsDir = path.resolve(import.meta.dirname, "../../prisma/migrations");
  const migrations = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of migrations) {
    await pg.exec(await readFile(path.join(migrationsDir, name, "migration.sql"), "utf8"));
  }
  current = { pg, prisma: new PrismaClient({ adapter: new PrismaPGlite(pg) }) };
  return current.prisma;
}

export async function resetTestDb(): Promise<void> {
  await current?.pg.exec(
    `TRUNCATE stock_entries, delivery_pending_reasons, sales_return_reasons, sales_collection_allocations, sales_bill_lines, sales_bills, sales_order_events, sales_order_lines, sales_orders, item_prices, price_lists, customer_addresses, sales_quotation_lines, sales_quotations, document_sequences, sales_targets, sales_collections, sales_return_lines, sales_returns, sales_delivery_lines, sales_deliveries, items, item_categories, customers, customer_groups, sales_areas, sales_persons, user_sessions, users, term_applicability, terms_conditions, office_assets, warehouses, offices, business_units, companies CASCADE`,
  );
}

export async function stopTestDb(): Promise<void> {
  await current?.prisma.$disconnect();
  await current?.pg.close();
  current = undefined;
}
