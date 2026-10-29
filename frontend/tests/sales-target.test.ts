import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createCollection } from "@/features/sales/collections/services/collection.service";
import { getSalesDashboard } from "@/features/sales/dashboard/services/dashboard.service";
import { createDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { adjustStock } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createItem, createSalesPerson, createSetupRecord } from "@/features/sales/masters/services/masters.service";
import { approveReturn, createReturn } from "@/features/sales/returns/services/return.service";
import {
  assignPlan,
  commissionReport,
  createBudget,
  createCommission,
  createPlan,
  deleteCommission,
  getBudget,
  listBudgets,
  planReport,
  saveBudgetPerson,
  targetReport,
  updateCommission,
} from "@/features/sales/targets/services/target.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";

describe("sales targets and commissions", () => {
  let prisma: PrismaClient;
  let businessUnitId: string;
  let officeId: string;
  let warehouseId: string;
  let manik: string;
  let rafiq: string;
  let dhaka: string;
  let arif: string;
  let rasel: string;
  let noodles: string;
  let chips: string;

  /** Credit delivery (no VAT) by a sales force. */
  const deliver = (customerId: string, salesPersonId: string, deliveryDate: string, lines: [string, number, number][]) =>
    createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId,
      officeId,
      warehouseId,
      salesPersonId,
      priceIncludesVat: true,
      discountAmount: 0,
      deliveryDate,
      paymentMethod: "CREDIT",
      paymentTermDays: 7,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 0,
      lines: lines.map(([itemId, qty, unitPrice]) => ({ itemId, qty, unitPrice, discountPercent: 0, vatPercent: 0, aitPercent: 0 })),
    });

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "FG WH" } })).id;
    manik = (await createSalesPerson(adminActor, { businessUnitId, name: "Md. Manik Miah", designation: "TSM" })).id;
    rafiq = (await createSalesPerson(adminActor, { businessUnitId, name: "Md. Rafiqul Islam", designation: "SR" })).id;
    dhaka = (await createSetupRecord(adminActor, "customer-groups", { businessUnitId, name: "Dhaka Region" })).id;
    arif = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7, customerGroupId: dhaka })).id;
    rasel = (await createCustomer(adminActor, { businessUnitId, name: "M/S Rasel Enterprise", creditDays: 7 })).id;
    noodles = (await createItem(adminActor, { businessUnitId, name: "Marine Noodles", uom: "PCS", salesRate: 10 })).id;
    chips = (await createItem(adminActor, { businessUnitId, name: "Marine Chips", uom: "PCS", salesRate: 5 })).id;
    for (const itemId of [noodles, chips]) await adjustStock(adminActor, { warehouseId, itemId, qty: 10_000, source: "OPENING", postingDate: "2026-01-01" });
  });

  afterAll(stopTestDb);

  it("keeps a yearly budget per sales force and reports achievement net of returns", async () => {
    const budget = await createBudget(adminActor, {
      businessUnitId,
      targetType: "EMPLOYEE",
      basis: "AMOUNT",
      year: 2026,
      persons: [
        { salesPersonId: manik, months: [{ month: 9, value: 2000 }, { month: 10, value: 3000 }] },
        { salesPersonId: rafiq, months: [{ month: 10, value: 1000 }] },
      ],
    });
    expect(budget).toMatchObject({ basis: "AMOUNT", year: 2026, total: 6000, personCount: 2 });
    await expect(createBudget(adminActor, { businessUnitId, targetType: "EMPLOYEE", basis: "AMOUNT", year: 2026, persons: [{ salesPersonId: manik, months: [{ month: 1, value: 1 }] }] })).rejects.toMatchObject({ status: 409 });

    // Details dialog: change one sales force, remove another.
    await saveBudgetPerson(adminActor, budget.id, { salesPersonId: manik, months: [{ month: 9, value: 2500 }, { month: 10, value: 3000 }] });
    const edited = await saveBudgetPerson(adminActor, budget.id, { salesPersonId: rafiq, months: [] });
    expect(edited).toMatchObject({ total: 5500, personCount: 1 });
    expect((await getBudget(adminActor, budget.id)).persons[0].months).toEqual([{ month: 9, value: 2500 }, { month: 10, value: 3000 }]);
    expect(await listBudgets(scopedActor([OTHER_COMPANY]))).toHaveLength(0);

    const sold = await deliver(arif, manik, "2026-10-05", [[noodles, 200, 10]]); // 2,000
    const back = await createReturn(adminActor, { mode: "PARTIAL", deliveryId: sold.id, officeId, warehouseId, returnDate: "2026-10-06", lines: [{ deliveryLineId: sold.lines[0].id, qty: 20 }] });
    await approveReturn(adminActor, back.id, { version: back.updatedAt });

    const report = await targetReport(adminActor, { fromMonth: "9", toMonth: "10", year: "2026", basis: "AMOUNT" });
    expect(report).toEqual([
      expect.objectContaining({ name: "Md. Manik Miah", month: 9, target: 2500, achieved: 0, percent: 0 }),
      expect.objectContaining({ name: "Md. Manik Miah", month: 10, target: 3000, achieved: 1800, percent: 60 }),
    ]);
    // The dashboard reads the same amount targets.
    const dashboard = await getSalesDashboard(adminActor, { from: "2026-10-01", to: "2026-10-31" });
    expect(dashboard.target).toMatchObject({ target: 3000, achieved: 1800 });
  });

  it("assigns a target to the sales force and pays commission only when target and collection are reached", async () => {
    const plan = await createPlan(adminActor, {
      officeId,
      createDate: "2026-10-01",
      basis: "AMOUNT",
      name: "Puja Campaign",
      targetAmount: 5000,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      customerGroupWise: false,
      lines: [{ customerId: arif, itemId: noodles, rate: 10, qty: 500, amount: 5000 }],
    });
    expect(plan).toMatchObject({ number: "ST-2026-00001", customers: 1, assigned: 0 });
    await assignPlan(adminActor, {
      planId: plan.id,
      rows: [
        { salesPersonId: manik, targetAmount: 3000, commissionBasis: "PERCENT", commissionRate: 2, minimumCollection: 1000 },
        { salesPersonId: rafiq, targetAmount: 1000, commissionBasis: "AMOUNT", commissionRate: 500, minimumCollection: 0 },
      ],
    });

    // Counted: noodles to Arif in October. Not counted: chips, Rasel, September.
    const sold = await deliver(arif, manik, "2026-10-10", [[noodles, 350, 10], [chips, 100, 5]]);
    await deliver(rasel, manik, "2026-10-11", [[noodles, 100, 10]]);
    await deliver(arif, manik, "2026-09-30", [[noodles, 100, 10]]);
    await deliver(arif, rafiq, "2026-10-12", [[noodles, 50, 10]]);

    let rows = await planReport(adminActor, { planId: plan.id });
    const manikRow = () => rows.find((row) => row.salesPersonName === "Md. Manik Miah")!;
    expect(manikRow()).toMatchObject({ targetAmount: 3000, achieved: 3500, collection: 0, earned: false, commission: 0 });
    expect(rows.find((row) => row.salesPersonName === "Md. Rafiqul Islam")).toMatchObject({ achieved: 500, percent: 50, earned: false });

    await createCollection(adminActor, { kind: "INVOICE", officeId, customerId: arif, collectionDate: "2026-10-15", method: "CASH", salesPersonId: manik, amount: 1000, allocations: [{ deliveryId: sold.id, amount: 1000 }] });
    rows = await planReport(adminActor, { planId: plan.id });
    expect(manikRow()).toMatchObject({ collection: 1000, earned: true, commission: 70 }); // 2% of 3,500
  });

  it("pays item commission per unit or percent, net of returns, without overlapping setups", async () => {
    const setup = await createCommission(adminActor, {
      name: "October Push",
      salesPersonId: manik,
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      lines: [
        { itemId: noodles, basis: "AMOUNT", value: 0.5 },
        { itemId: chips, basis: "PERCENT", value: 10 },
      ],
    });
    await expect(
      createCommission(adminActor, { name: "Clash", salesPersonId: manik, fromDate: "2026-10-15", toDate: "2026-11-15", lines: [{ itemId: noodles, basis: "AMOUNT", value: 1 }] }),
    ).rejects.toMatchObject({ status: 409 });

    const sold = await deliver(arif, manik, "2026-10-10", [[noodles, 100, 10], [chips, 40, 5]]);
    await deliver(arif, rafiq, "2026-10-10", [[noodles, 100, 10]]); // another sales force
    const back = await createReturn(adminActor, { mode: "PARTIAL", deliveryId: sold.id, officeId, warehouseId, returnDate: "2026-10-12", lines: [{ deliveryLineId: sold.lines[0].id, qty: 10 }] });
    await approveReturn(adminActor, back.id, { version: back.updatedAt });

    const report = await commissionReport(adminActor, { viewBy: "ITEM", from: "2026-10-01", to: "2026-10-31" });
    expect(report.lines.map((line) => [line.itemName, line.qty, line.commission])).toEqual(
      expect.arrayContaining([
        ["Marine Noodles", 90, 45],
        ["Marine Chips", 40, 20],
      ]),
    );
    expect(report.totalCommission).toBe(65);
    expect(report.summary.map((row) => row.name)).toHaveLength(2);
    expect((await commissionReport(adminActor, { viewBy: "EMPLOYEE", from: "2026-10-01", to: "2026-10-31" })).summary).toEqual([
      expect.objectContaining({ name: "Md. Manik Miah", commission: 65 }),
    ]);

    // Editing the setup changes the report; deleting it stops it.
    await updateCommission(adminActor, setup.id, { version: setup.updatedAt, data: { name: "October Push", salesPersonId: manik, fromDate: "2026-10-01", toDate: "2026-10-31", lines: [{ itemId: noodles, basis: "AMOUNT", value: 1 }] } });
    expect((await commissionReport(adminActor, { viewBy: "ITEM", from: "2026-10-01", to: "2026-10-31" })).totalCommission).toBe(90);
    await deleteCommission(adminActor, setup.id);
    expect((await commissionReport(adminActor, { viewBy: "ITEM", from: "2026-10-01", to: "2026-10-31" })).lines).toHaveLength(0);
  });
});
