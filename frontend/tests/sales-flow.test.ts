import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDueCollection, listDue, listDueInvoices, listLedger } from "@/features/sales/collections/services/collection.service";
import { getSalesDashboard } from "@/features/sales/dashboard/services/dashboard.service";
import { createDelivery, deleteDelivery, listApprovedOrders, listDeliveries } from "@/features/sales/deliveries/services/delivery.service";
import { adjustStock, getStockLevels } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createItem, createSalesPerson } from "@/features/sales/masters/services/masters.service";
import { changeOrderStatus, createOrder, getOrder, listOrders } from "@/features/sales/orders/services/order.service";
import { changeQuotationStatus, createQuotation, getQuotation } from "@/features/sales/quotations/services/quotation.service";
import { getReport } from "@/features/sales/reports/services/report.service";
import { approveReturn, createReturn, listReturnableDeliveries } from "@/features/sales/returns/services/return.service";
import { createBudget, targetReport } from "@/features/sales/targets/services/target.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const MONTH = { from: "2026-10-01", to: "2026-10-31" };
const AS_OF = "2026-10-31";

/**
 * One customer's sale through every Sales page: each step must show up at once in
 * the pages that read it (no copies, no caches): quotation → order → deliveries →
 * return → collection, with stock, dues, target, dashboard and reports alongside.
 */
describe("sales modules work together", () => {
  let prisma: PrismaClient;
  let officeId: string;
  let warehouseId: string;
  let salesPersonId: string;
  let customerId: string;
  let itemId: string;

  const stock = async () => (await getStockLevels(adminActor, warehouseId, [itemId]))[0].qty;
  const dashboard = () => getSalesDashboard(adminActor, MONTH);
  const dueOf = async (deliveryId: string) => (await listDueInvoices(adminActor, { asOf: AS_OF })).find((row) => row.deliveryId === deliveryId)?.due ?? 0;
  const report = (report: string) => getReport(adminActor, { report, asOf: AS_OF, ...MONTH });
  const deliverFor = (orderId: string, orderLineId: string, qty: number, deliveryDate: string) =>
    createDelivery(adminActor, {
      deliveryType: "SALES_ORDER",
      salesOrderId: orderId,
      officeId,
      warehouseId,
      deliveryDate,
      paymentMethod: "CREDIT",
      paymentTermDays: 7,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 0,
      lines: [{ orderLineId, qty }],
    });

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "FG WH" } })).id;
    salesPersonId = (await createSalesPerson(adminActor, { businessUnitId, name: "Md. Manik Miah", designation: "TSM" })).id;
    customerId = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7, salesPersonId })).id;
    itemId = (await createItem(adminActor, { businessUnitId, name: "Marine Noodles", uom: "PCS", salesRate: 100 })).id;
    await adjustStock(adminActor, { warehouseId, itemId, qty: 1000, source: "OPENING", postingDate: "2026-09-01" });
    await createBudget(adminActor, {
      businessUnitId,
      targetType: "EMPLOYEE",
      basis: "AMOUNT",
      year: 2026,
      persons: [{ salesPersonId, months: [{ month: 10, value: 10_000 }] }],
    });
  });

  afterAll(stopTestDb);

  it("updates every page from the same records", async () => {
    // Nothing sold yet: the dashboard shows the target with nothing achieved.
    expect((await dashboard()).target).toMatchObject({ target: 10_000, achieved: 0 });

    // ── Quotation → approved ──
    const quotation = await createQuotation(adminActor, {
      officeId,
      customerId,
      salesPersonId,
      quotationDate: "2026-10-02",
      validTill: "2026-10-20",
      quotationType: "Quotation",
      includingVat: true,
      lines: [{ itemId, qty: 50, rate: 100 }],
    });
    const approvedQuotation = await changeQuotationStatus(adminActor, quotation.id, { action: "approve", version: quotation.updatedAt });
    expect(approvedQuotation.status).toBe("SUBMITTED");

    // ── Sales Order from the quotation → the quotation is marked Ordered ──
    const order = await createOrder(adminActor, {
      officeId,
      customerId,
      salesPersonId,
      quotationId: quotation.id,
      orderType: "SALES",
      paymentMethod: "CASH",
      orderDate: "2026-10-03",
      expectedDeliveryDate: "2026-10-05",
      priceIncludesVat: true,
      isForeign: false,
      paymentTermDays: 7,
      dueLimit: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
      lines: [{ itemId, qty: 50, unitPrice: 100, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
    expect((await getQuotation(adminActor, quotation.id)).status).toBe("ORDERED");
    const submitted = await changeOrderStatus(adminActor, order.id, { action: "submit", version: order.updatedAt, today: "2026-10-03" });
    expect(submitted.status).toBe("APPROVED");
    // Approved orders appear on Sales Delivery › Approved SO.
    expect((await listApprovedOrders(adminActor, {})).map((row) => row.number)).toEqual([order.number]);

    // ── Part delivery: stock, order progress, dues, dashboard, target ──
    const first = await deliverFor(order.id, order.lines[0].id, 30, "2026-10-05");
    expect(await stock()).toBe(970);
    expect((await getOrder(adminActor, order.id)).lines[0].deliveredQty).toBe(30);
    expect((await listApprovedOrders(adminActor, {}))[0]).toMatchObject({ status: "PARTIALLY_DELIVERED", deliveredPercent: 60 });
    expect(await dueOf(first.id)).toBe(3000);
    expect((await dashboard()).totals.sales).toBe(3000);

    // ── Rest delivered: the order completes and leaves Approved SO ──
    const second = await deliverFor(order.id, order.lines[0].id, 20, "2026-10-06");
    expect((await getOrder(adminActor, order.id)).status).toBe("COMPLETED");
    expect(await listApprovedOrders(adminActor, {})).toEqual([]);
    expect((await listDeliveries(adminActor, {})).totalCount).toBe(2);
    expect(await stock()).toBe(950);

    // ── Sales Return of 5 from the first delivery: stock back, due and sales down ──
    expect((await listReturnableDeliveries(adminActor, {})).map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
    const salesReturn = await createReturn(adminActor, {
      mode: "PARTIAL",
      deliveryId: first.id,
      officeId,
      warehouseId,
      returnDate: "2026-10-07",
      lines: [{ deliveryLineId: first.lines[0].id, qty: 5 }],
    });
    expect(await dueOf(first.id)).toBe(3000); // a pending return changes nothing yet
    await approveReturn(adminActor, salesReturn.id, { version: salesReturn.updatedAt });
    expect(await stock()).toBe(955);
    expect(await dueOf(first.id)).toBe(2500);

    // ── Sales Collection settles the first invoice ──
    await createDueCollection(adminActor, {
      officeId,
      collectionDate: "2026-10-08",
      method: "CASH",
      cashType: "Cash in Hand",
      salesPersonId,
      rows: [{ customerId, allocations: [{ deliveryId: first.id, amount: 2500 }] }],
    });
    expect(await dueOf(first.id)).toBe(0);
    expect(await dueOf(second.id)).toBe(2000);
    const [due] = await listDue(adminActor, { asOf: AS_OF });
    expect(due).toMatchObject({ customerName: "M/S Arif Enterprise", due: 2000 });
    expect((await listLedger(adminActor, { asOf: AS_OF }))[0]).toMatchObject({ salesDue: 2000, ledger: 2000, diff: 0 });

    // ── Dashboard: sales net of returns, collection, target achieved, top lists ──
    const board = await dashboard();
    expect(board.totals).toEqual({ sales: 4500, monthSales: 4500, collection: 2500 });
    expect(board.target).toMatchObject({ target: 10_000, achieved: 4500 });
    expect(board.topItems[0]).toMatchObject({ name: "Marine Noodles", amount: 4500, qty: 45 });
    expect(board.topCustomers[0]).toMatchObject({ name: "M/S Arif Enterprise", amount: 4500 });
    expect(board.topSalesPersons[0]).toMatchObject({ name: "Md. Manik Miah", amount: 4500 });

    // ── Sales Target report reads the same sales ──
    expect(await targetReport(adminActor, { fromMonth: "10", toMonth: "10", year: "2026", basis: "AMOUNT" })).toEqual([
      expect.objectContaining({ name: "Md. Manik Miah", target: 10_000, achieved: 4500, percent: 45 }),
    ]);

    // ── Sales Report & Analytics read the same records ──
    const deliveriesReport = JSON.stringify((await report("delivery-report")).rows);
    expect(deliveriesReport).toContain(first.number);
    expect(deliveriesReport).toContain(second.number);
    expect(JSON.stringify((await report("return-report")).rows)).toContain(salesReturn.number);
    expect((await report("customer-sales")).rows.length).toBeGreaterThan(0);
    expect(JSON.stringify((await report("order-booking")).rows)).toContain(order.number);

    // ── Undo the second delivery: stock, order, dues and dashboard follow ──
    const fresh = (await listDeliveries(adminActor, {})).rows.find((row) => row.id === second.id)!;
    await deleteDelivery(adminActor, second.id, { version: fresh.updatedAt, reason: "Entered by mistake" });
    expect(await stock()).toBe(975);
    expect((await getOrder(adminActor, order.id)).status).toBe("APPROVED");
    expect((await listApprovedOrders(adminActor, {}))[0]).toMatchObject({ id: order.id, status: "PARTIALLY_DELIVERED" });
    expect(await dueOf(second.id)).toBe(0);
    expect((await dashboard()).totals.sales).toBe(2500);
    expect((await listOrders(adminActor, { status: "APPROVED" })).rows.map((row) => row.id)).toEqual([order.id]);
  });
});
