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
    `TRUNCATE hr_policy_records, payroll_run_lines, payroll_runs, bonus_lines, bonus_runs, salary_increments, leave_attachments, leave_applications, movement_applications, attendance_punches, attendance_devices, sales_commission_lines, sales_commissions, sales_target_assignments, sales_target_plan_lines, sales_target_plans, sales_target_budgets, production_entry_materials, production_order_approvals, production_order_materials, production_orders, production_bom_links, production_bom_overheads, production_bom_wastages, production_bom_materials, production_bom_outputs, production_boms, production_entries, production_work_center_operators, production_work_centers, production_department_sections, production_departments, production_work_center_types, audit_logs, api_tokens, permission_group_entries, permission_groups, user_group_members, user_groups, approval_stage_approvers, approval_stages, approval_pipelines, sales_wallets, bank_accounts, sales_return_prices, standard_prices, sales_territory_employees, sales_territory_nodes, sales_territory_layers, customer_group_price_lines, customer_group_price_setups, customer_price_lines, customer_price_setups, sales_offer_special_lines, sales_offer_discount_lines, sales_offer_bonus_lines, sales_offer_pair_lines, sales_offer_item_lines, sales_offers, opening_stock_lines, opening_stock_receipts, item_divisions, item_uoms, customer_attachments, supplier_attachments, supplier_details, suppliers, supplier_groups, tax_brackets, thanas, stock_entries, delivery_pending_reasons, sales_return_reasons, sales_collection_allocations, sales_bill_lines, sales_bills, sales_order_events, sales_order_lines, sales_orders, item_prices, price_lists, customer_addresses, sales_quotation_lines, sales_quotations, document_sequences, sales_targets, sales_collections, sales_return_lines, sales_returns, sales_delivery_lines, sales_deliveries, items, item_categories, customers, customer_groups, sales_areas, sales_persons, user_sessions, users, term_applicability, terms_conditions, office_assets, warehouses, offices, business_units, companies, budget_lines, budgets, received_cheques, cheque_issues, cheque_books, fund_transfers, expense_records, journal_voucher_lines, journal_vouchers, cost_centers, accounts CASCADE`,
  );
}

export async function stopTestDb(): Promise<void> {
  await current?.prisma.$disconnect();
  await current?.pg.close();
  current = undefined;
}
