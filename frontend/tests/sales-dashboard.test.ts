import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ageBalance, monthStarts, netOfReturns, topKeys } from "@/features/sales/dashboard/lib/aggregate";
import { dashboardQuerySchema } from "@/features/sales/dashboard/schemas/dashboard.schema";
import { getSalesDashboard } from "@/features/sales/dashboard/services/dashboard.service";
import { adminActor, businessUnitInput, companyInput, scopedActor } from "./helpers/fixtures";
import { startTestDb, stopTestDb } from "./helpers/test-db";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("ageBalance", () => {
  it("settles the oldest dues first", () => {
    expect(ageBalance({ pastDue: 1000, dueToday: 600, notYetDue: 0, credits: 350 })).toEqual({
      overdue: 650,
      dueToday: 600,
      due: 600,
    });
  });

  it("spills credits into today's and future dues once the overdue is cleared", () => {
    expect(ageBalance({ pastDue: 100, dueToday: 200, notYetDue: 300, credits: 250 })).toEqual({
      overdue: 0,
      dueToday: 50,
      due: 350,
    });
  });

  it("never goes negative when the customer has paid in advance", () => {
    expect(ageBalance({ pastDue: 100, dueToday: 0, notYetDue: 0, credits: 500 })).toEqual({
      overdue: 0,
      dueToday: 0,
      due: 0,
    });
  });
});

describe("netOfReturns / topKeys", () => {
  it("subtracts returns and ranks positive totals only", () => {
    const net = netOfReturns(
      new Map([
        ["a", { amount: 100, qty: 2 }],
        ["b", { amount: 300, qty: 3 }],
      ]),
      new Map([
        ["b", { amount: 50, qty: 1 }],
        ["c", { amount: 10, qty: 1 }],
      ]),
    );
    expect(net.get("b")).toEqual({ amount: 250, qty: 2 });
    expect(net.get("c")).toEqual({ amount: -10, qty: -1 });
    expect(topKeys(net, 10)).toEqual(["b", "a"]);
    expect(topKeys(net, 1)).toEqual(["b"]);
  });
});

describe("monthStarts", () => {
  it("lists every month a range touches, across years", () => {
    expect(monthStarts("2026-11-15", "2027-01-03")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(monthStarts("2026-10-01", "2026-10-11")).toEqual(["2026-10-01"]);
  });
});

describe("dashboardQuerySchema", () => {
  it("rejects reversed and oversized ranges", () => {
    expect(dashboardQuerySchema.safeParse({ from: "2026-10-11", to: "2026-10-01" }).success).toBe(false);
    expect(dashboardQuerySchema.safeParse({ from: "2025-01-01", to: "2026-10-01" }).success).toBe(false);
    expect(dashboardQuerySchema.safeParse({ from: "2026-10-1", to: "2026-10-11" }).success).toBe(false);
    expect(dashboardQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-11" }).success).toBe(true);
  });
});

describe("getSalesDashboard", () => {
  let prisma: PrismaClient;
  let companyId: string;
  let businessUnitId: string;
  const query = { from: "2026-10-01", to: "2026-10-11" };

  beforeAll(async () => {
    prisma = await startTestDb();
    const company = await prisma.company.create({ data: companyInput });
    companyId = company.id;
    const unit = await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } });
    businessUnitId = unit.id;
    const bu = { businessUnitId };

    const anarul = await prisma.salesPerson.create({ data: { ...bu, code: "SP-1", name: "Md. Anarul Islam", designation: "RSM" } });
    const younus = await prisma.salesPerson.create({ data: { ...bu, code: "SP-2", name: "Md. Younus Ali", designation: "RSM" } });
    const vaiVai = await prisma.customer.create({ data: { ...bu, code: "C-1", name: "Vai Vai Traders", territoryId: (await prisma.salesArea.create({ data: { ...bu, kind: "TERRITORY", name: "Gaibandha" } })).id } });
    const sobuj = await prisma.customer.create({ data: { ...bu, code: "C-2", name: "Sobuj Poultry Farm", territoryId: (await prisma.salesArea.create({ data: { ...bu, kind: "TERRITORY", name: "Jashore" } })).id } });
    const biriyani = await prisma.item.create({ data: { ...bu, code: "IT-1", name: "Bar-B-Q Biriyani", salesRate: 100 } });
    const dal = await prisma.item.create({ data: { ...bu, code: "IT-2", name: "Dal Vaja 10gm", salesRate: 50 } });

    const delivery = (
      number: string,
      customerId: string,
      salesPersonId: string,
      deliveryDate: string,
      dueDate: string,
      lines: { itemId: string; qty: number; rate: number }[],
      status: "SUBMITTED" | "DRAFT" = "SUBMITTED",
    ) =>
      prisma.salesDelivery.create({
        data: {
          ...bu,
          number,
          customerId,
          salesPersonId,
          deliveryDate: day(deliveryDate),
          dueDate: day(dueDate),
          status,
          totalQty: lines.reduce((sum, line) => sum + line.qty, 0),
          totalAmount: lines.reduce((sum, line) => sum + line.qty * line.rate, 0),
          lines: { create: lines.map((line, index) => ({ ...line, lineNo: index + 1, amount: line.qty * line.rate })) },
        },
      });

    // Before the range: only affects receivables.
    await delivery("D-1", vaiVai.id, anarul.id, "2026-09-15", "2026-09-30", [{ itemId: biriyani.id, qty: 10, rate: 100 }]);
    // Falls due on the To Date.
    await delivery("D-2", vaiVai.id, anarul.id, "2026-10-02", "2026-10-11", [
      { itemId: biriyani.id, qty: 5, rate: 100 },
      { itemId: dal.id, qty: 2, rate: 50 },
    ]);
    await delivery("D-3", sobuj.id, younus.id, "2026-10-05", "2026-10-20", [{ itemId: dal.id, qty: 20, rate: 50 }]);
    // Drafts never count.
    await delivery("D-4", sobuj.id, younus.id, "2026-10-06", "2026-10-06", [{ itemId: biriyani.id, qty: 100, rate: 100 }], "DRAFT");

    await prisma.salesReturn.create({
      data: {
        ...bu,
        number: "R-1",
        customerId: vaiVai.id,
        salesPersonId: anarul.id,
        returnDate: day("2026-10-03"),
        status: "SUBMITTED",
        totalQty: 1,
        totalAmount: 50,
        lines: { create: [{ lineNo: 1, itemId: dal.id, qty: 1, rate: 50, amount: 50 }] },
      },
    });
    await prisma.salesCollection.createMany({
      data: [
        { ...bu, number: "COL-1", customerId: vaiVai.id, collectionDate: day("2026-10-04"), amount: 300, status: "SUBMITTED" },
        // After the To Date: ignored.
        { ...bu, number: "COL-2", customerId: sobuj.id, collectionDate: day("2026-10-12"), amount: 999, status: "SUBMITTED" },
      ],
    });
    await prisma.salesTarget.createMany({
      data: [
        { ...bu, salesPersonId: anarul.id, month: day("2026-10-01"), amount: 1000 },
        { ...bu, salesPersonId: younus.id, month: day("2026-10-01"), amount: 2000 },
        // Outside the range.
        { ...bu, salesPersonId: younus.id, month: day("2026-08-01"), amount: 500 },
      ],
    });
  });

  afterAll(stopTestDb);

  it("totals submitted sales net of returns, and collections", async () => {
    const dashboard = await getSalesDashboard(adminActor, query);
    expect(dashboard.totals).toEqual({ sales: 1550, monthSales: 1550, collection: 300 });
  });

  it("compares targets of the range's months with each sales person's net sales", async () => {
    const { target } = await getSalesDashboard(adminActor, query);
    expect(target.target).toBe(3000);
    expect(target.achieved).toBe(1550);
    expect(target.salesPersons.map((row) => [row.name, row.target, row.achieved])).toEqual([
      ["Md. Younus Ali", 2000, 1000],
      ["Md. Anarul Islam", 1000, 550],
    ]);
  });

  it("ages receivables as of the To Date", async () => {
    const dashboard = await getSalesDashboard(adminActor, query);
    expect(dashboard.overdue).toEqual([
      { customerId: expect.any(String), name: "Vai Vai Traders", overdue: 650, due: 600 },
    ]);
    expect(dashboard.dueToday.map((row) => [row.name, row.amount])).toEqual([["Vai Vai Traders", 600]]);
  });

  it("ranks items, customers and sales persons by net amount", async () => {
    const dashboard = await getSalesDashboard(adminActor, query);
    expect(dashboard.topItems.map((row) => [row.name, row.amount, row.qty])).toEqual([
      ["Dal Vaja 10gm", 1050, 21],
      ["Bar-B-Q Biriyani", 500, 5],
    ]);
    expect(dashboard.topCustomers.map((row) => [row.name, row.detail, row.amount, row.qty])).toEqual([
      ["Sobuj Poultry Farm", "Jashore", 1000, 20],
      ["Vai Vai Traders", "Gaibandha", 550, 6],
    ]);
    expect(dashboard.topSalesPersons.map((row) => [row.name, row.amount])).toEqual([
      ["Md. Younus Ali", 1000],
      ["Md. Anarul Islam", 550],
    ]);
  });

  it("shows nothing from companies outside the actor's scope", async () => {
    const dashboard = await getSalesDashboard(scopedActor(["00000000-0000-4000-8000-000000000000"]), query);
    expect(dashboard.totals).toEqual({ sales: 0, monthSales: 0, collection: 0 });
    expect(dashboard.overdue).toEqual([]);
    expect(dashboard.topItems).toEqual([]);
    expect(dashboard.target.salesPersons).toEqual([]);

    await expect(getSalesDashboard(scopedActor([companyId]), { ...query, businessUnitId })).resolves.toMatchObject({
      totals: { sales: 1550 },
    });
    await expect(
      getSalesDashboard(scopedActor(["00000000-0000-4000-8000-000000000000"]), { ...query, businessUnitId }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
