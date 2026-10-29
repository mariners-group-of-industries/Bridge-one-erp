import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createCollection } from "@/features/sales/collections/services/collection.service";
import { createDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { adjustStock } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createItem, createSalesPerson, createSetupRecord } from "@/features/sales/masters/services/masters.service";
import { changeOrderStatus, createOrder } from "@/features/sales/orders/services/order.service";
import { ANALYTICS, REPORTS } from "@/features/sales/reports/schemas/report.schema";
import { getReport } from "@/features/sales/reports/services/report.service";
import { approveReturn, createReturn } from "@/features/sales/returns/services/return.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const TODAY = "2026-10-14";

describe("sales reports", () => {
  let prisma: PrismaClient;
  let officeId: string;
  let warehouseId: string;
  let manik: string;
  let arif: string;
  let rasel: string;
  let noodles: string;
  let chips: string;
  let groupId: string;

  const base = { asOf: TODAY, from: "2026-09-01", to: TODAY };
  const report = (key: string, filters: Record<string, string> = {}) => getReport(adminActor, { ...base, report: key, ...filters });
  const row = (rows: Record<string, unknown>[], key: string, value: unknown) => rows.find((candidate) => candidate[key] === value);

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "FG WH" } })).id;
    manik = (await createSalesPerson(adminActor, { businessUnitId, name: "Md. Manik Miah" })).id;
    groupId = (await createSetupRecord(adminActor, "customer-groups", { businessUnitId, name: "Dhaka Region" })).id;
    arif = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7, creditLimit: 2000, customerGroupId: groupId, salesPersonId: manik })).id;
    rasel = (await createCustomer(adminActor, { businessUnitId, name: "M/S Rasel Enterprise", creditDays: 0 })).id;
    noodles = (await createItem(adminActor, { businessUnitId, name: "Marine Noodles", uom: "PCS", salesRate: 10 })).id;
    chips = (await createItem(adminActor, { businessUnitId, name: "Marine Chips", uom: "PCS", salesRate: 5 })).id;
    for (const itemId of [noodles, chips]) await adjustStock(adminActor, { warehouseId, itemId, qty: 10_000, source: "OPENING", postingDate: "2026-01-01" });

    // Arif: 1,500 on 20 Sep (due 27 Sep), 20 noodles back, 500 collected. Rasel: 100 cash on 1 Oct.
    const sold = await createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId: arif,
      officeId,
      warehouseId,
      salesPersonId: manik,
      priceIncludesVat: true,
      discountAmount: 0,
      deliveryDate: "2026-09-20",
      paymentMethod: "CREDIT",
      paymentTermDays: 7,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 0,
      lines: [
        { itemId: noodles, qty: 100, unitPrice: 10, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
        { itemId: chips, qty: 100, unitPrice: 5, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
      ],
    });
    const back = await createReturn(adminActor, { mode: "PARTIAL", deliveryId: sold.id, officeId, warehouseId, returnDate: "2026-10-01", lines: [{ deliveryLineId: sold.lines[0].id, qty: 20 }] });
    await approveReturn(adminActor, back.id, { version: back.updatedAt });
    await createCollection(adminActor, { kind: "INVOICE", officeId, customerId: arif, collectionDate: "2026-10-05", method: "BANK", salesPersonId: manik, amount: 500, allocations: [{ deliveryId: sold.id, amount: 500 }] });
    await createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId: rasel,
      officeId,
      warehouseId,
      priceIncludesVat: true,
      discountAmount: 0,
      deliveryDate: "2026-10-01",
      paymentMethod: "CASH",
      paymentTermDays: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 100,
      lines: [{ itemId: chips, qty: 20, unitPrice: 5, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
    const order = await createOrder(adminActor, {
      officeId,
      customerId: arif,
      salesPersonId: manik,
      orderType: "SALES",
      paymentMethod: "CASH",
      orderDate: "2026-10-10",
      expectedDeliveryDate: "2026-10-12",
      priceIncludesVat: true,
      isForeign: false,
      referredBy: "Mr. Karim",
      paymentTermDays: 0,
      dueLimit: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
      lines: [{ itemId: noodles, qty: 30, unitPrice: 10, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
    await changeOrderStatus(adminActor, order.id, { action: "submit", version: order.updatedAt, today: TODAY });
  });

  afterAll(stopTestDb);

  it("runs every report in the View By list", async () => {
    for (const definition of REPORTS) {
      const filters: Record<string, string> = { year: "2026", fromMonth: "9", toMonth: "10", ...(definition.key === "customer-ledger" ? { customerId: arif } : {}) };
      const result = await report(definition.key, filters);
      expect(result.title, definition.key).toBe(definition.label);
      expect(result.columns.length, definition.key).toBeGreaterThan(0);
    }
    await expect(report("customer-ledger")).rejects.toMatchObject({ status: 400 });
  });

  it("adds up sales, returns and collections per customer, item and month", async () => {
    const customers = await report("customer-sales");
    expect(row(customers.rows, "name", "M/S Arif Enterprise")).toMatchObject({ invoices: 1, sales: 1500, returns: 200, net: 1300, collection: 500 });
    expect(row(customers.rows, "name", "M/S Rasel Enterprise")).toMatchObject({ sales: 100, collection: 100 });

    const items = await report("item");
    expect(row(items.rows, "name", "Marine Noodles")).toMatchObject({ qty: 100, amount: 1000, returnQty: 20, returns: 200, netQty: 80, net: 800 });
    expect(row(items.rows, "name", "Marine Chips")).toMatchObject({ qty: 120, net: 600 });

    const months = await report("month-sales");
    expect(months.rows.map((entry) => [entry.month, entry.sales, entry.returns])).toEqual([
      ["September 2026", 1500, 0],
      ["October 2026", 100, 200],
    ]);
    expect(row((await report("group-summary")).rows, "name", "Dhaka Region")).toMatchObject({ customers: 1, net: 1300 });
  });

  it("builds the customer ledger with opening and closing balances", async () => {
    const ledger = await report("customer-ledger", { customerId: arif, from: "2026-10-01" });
    expect(ledger.rows.map((entry) => [entry.type, entry.balance])).toEqual([
      ["Opening Balance", 1500],
      ["Sales Return", 1300],
      ["Collection", 800],
      ["Closing Balance", 800],
    ]);
  });

  it("reports credit use, overdue invoices, open orders and referrals", async () => {
    expect((await report("credit-utilization")).rows).toEqual([expect.objectContaining({ name: "M/S Arif Enterprise", limit: 2000, outstanding: 800, utilization: 40 })]);
    expect((await report("credit-utilization", { utilization: "50" })).rows).toHaveLength(0);
    expect((await report("available-balance")).rows.find((entry) => entry.name === "M/S Arif Enterprise")).toMatchObject({ balance: 800, available: 1200 });
    expect((await report("overdue")).rows).toEqual([expect.objectContaining({ name: "M/S Arif Enterprise", days: 17, due: 800 })]);
    expect((await report("order-remaining")).rows).toEqual([expect.objectContaining({ item: expect.stringContaining("Marine Noodles"), remaining: 30, value: 300 })]);
    expect((await report("delivery-schedule")).rows).toEqual([expect.objectContaining({ late: 2, remaining: 30 })]);
    expect((await report("referred-by")).rows).toEqual([expect.objectContaining({ name: "Mr. Karim", orders: 1, amount: 300 })]);
    expect((await getReport(scopedActor([OTHER_COMPANY]), { ...base, report: "customer-sales" })).rows).toHaveLength(0);
  });

  it("runs the analytics reports with sales area filters", async () => {
    for (const definition of ANALYTICS) {
      const result = await report(definition.key);
      expect(result.title, definition.key).toBe(definition.label);
    }
    await expect(getReport(adminActor, { asOf: TODAY, report: "collection" })).rejects.toMatchObject({ status: 400 });

    // Arif owes 800 on an invoice due 27 Sep: 17 days late as of 14 Oct.
    expect((await report("customer-aging")).rows).toEqual([expect.objectContaining({ name: "M/S Arif Enterprise", d30: 800, notDue: 0, total: 800 })]);
    expect((await report("customer-aging", { customerGroupId: groupId })).rows).toHaveLength(1);
    expect((await report("customer-aging", { territoryId: "00000000-0000-4000-8000-000000000001" })).rows).toHaveLength(0);

    const closing = await report("season-closing", { from: "2026-10-01" });
    expect(row(closing.rows, "name", "M/S Arif Enterprise")).toMatchObject({ opening: 1500, returns: 200, collections: 500, closing: 800 });
    expect(row((await report("group-recovery")).rows, "name", "Dhaka Region")).toMatchObject({ sales: 1500, recovery: 500, adjustment: 200, net: 800 });
    expect((await report("credit-note")).rows).toEqual([expect.objectContaining({ name: "M/S Arif Enterprise", amount: 200 })]);
    expect((await report("collection")).rows.map((entry) => entry.amount)).toEqual(expect.arrayContaining([500, 100]));
    expect((await report("master-invoice")).rows).toHaveLength(3);
    expect((await report("abp-target")).rows).toEqual([expect.objectContaining({ name: "Md. Manik Miah", achieved: 1300 })]);
    // October against September: chips fell from 500 to 100 sold.
    const comparison = await report("category-comparison", { from: "2026-10-01", to: "2026-10-14" });
    expect(row(comparison.rows, "name", "No category")).toMatchObject({ previous: 1500, current: -100 });
  });
});
