import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { DeliveryInput, OrderDeliveryInput } from "@/features/sales/deliveries/schemas/delivery.schema";
import {
  confirmDelivery,
  createDelivery,
  deleteDelivery,
  getDelivery,
  getOrderForDelivery,
  listApprovedOrders,
  listDeliveries,
  setOrderPendingReason,
  updateDelivery,
} from "@/features/sales/deliveries/services/delivery.service";
import { adjustStock, getItemStock, getStockLevels } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createItem, createSetupRecord, getCustomerCredit } from "@/features/sales/masters/services/masters.service";
import { changeOrderStatus, createOrder, getOrder } from "@/features/sales/orders/services/order.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const TODAY = "2026-10-12";

describe("sales delivery", () => {
  let prisma: PrismaClient;
  let businessUnitId: string;
  let officeId: string;
  let warehouseId: string;
  let otherOfficeWarehouseId: string;
  let customerId: string;
  let noodlesId: string;
  let muriId: string;
  let orderId: string;
  let noodlesLine: string;
  let muriLine: string;

  const header = {
    deliveryDate: TODAY,
    deliveryTime: "09:12",
    paymentMethod: "CREDIT" as const,
    paymentTermDays: 7,
    deliveryCharge: 0,
    unloadingCharge: 0,
    paidAmount: 0,
  };
  const forOrder = (lines: { orderLineId: string; qty: number }[], extra: Partial<OrderDeliveryInput> = {}): DeliveryInput => ({
    deliveryType: "SALES_ORDER",
    salesOrderId: orderId,
    officeId,
    warehouseId,
    ...header,
    lines,
    ...extra,
  });
  const stock = async (itemId: string) => (await getStockLevels(adminActor, warehouseId, [itemId]))[0].qty;
  const opening = (itemId: string, qty: number) =>
    adjustStock(adminActor, { warehouseId, itemId, qty, source: "OPENING", postingDate: TODAY, remarks: "Opening" });

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Finished Goods WH" } })).id;
    const otherOffice = (await prisma.office.create({ data: { ...officeInput, name: "Factory", businessUnitId } })).id;
    otherOfficeWarehouseId = (await prisma.warehouse.create({ data: { officeId: otherOffice, name: "Material WH" } })).id;

    const customer = await createCustomer(adminActor, {
      businessUnitId,
      name: "Sujon and Polash Enterprise",
      address: "Kalmakanda College Road",
      creditDays: 7,
      addresses: [{ label: "Shop", address: "Kalmakanda College Road, Netrokona", isDefault: true }],
    });
    customerId = customer.id;
    noodlesId = (
      await createItem(adminActor, {
        businessUnitId,
        name: "Marine Noodles 120 gm (1x24)",
        uom: "PCS",
        salesRate: 14.6,
        vatPercent: 15,
        altUom: "CTN",
        altUomFactor: 24,
        deliveryTolerancePercent: 5,
      })
    ).id;
    muriId = (await createItem(adminActor, { businessUnitId, name: "Marine Puffed Rice 400g", uom: "PCS", salesRate: 46.7 })).id;

    const order = await createOrder(adminActor, {
      officeId,
      customerId,
      shipToAddressId: customer.addresses[0].id,
      orderType: "SALES",
      paymentMethod: "CASH",
      orderDate: "2026-10-08",
      expectedDeliveryDate: "2026-10-08",
      priceIncludesVat: true,
      isForeign: false,
      paymentTermDays: 7,
      dueLimit: 0,
      discountAmount: 100,
      deliveryCharge: 0,
      unloadingCharge: 0,
      lines: [
        { itemId: noodlesId, qty: 480, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 },
        { itemId: muriId, qty: 200, unitPrice: 46.7, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
      ],
    });
    orderId = order.id;
    noodlesLine = order.lines[0].id;
    muriLine = order.lines[1].id;
    await changeOrderStatus(adminActor, orderId, { action: "submit", version: order.updatedAt, today: TODAY });
  });

  afterAll(stopTestDb);

  it("keeps a stock ledger and refuses to go negative", async () => {
    await opening(noodlesId, 1000);
    await adjustStock(adminActor, { warehouseId, itemId: noodlesId, qty: -10, source: "ADJUSTMENT", postingDate: TODAY, remarks: "Damaged" });
    expect(await stock(noodlesId)).toBe(990);
    await expect(
      adjustStock(adminActor, { warehouseId, itemId: noodlesId, qty: -5000, source: "ADJUSTMENT", postingDate: TODAY }),
    ).rejects.toMatchObject({ status: 400 });
    const summary = await getItemStock(adminActor, noodlesId);
    expect(summary.warehouses.find((row) => row.warehouseId === warehouseId)?.qty).toBe(990);
    expect(summary.entries.map((entry) => entry.source)).toEqual(expect.arrayContaining(["OPENING", "ADJUSTMENT"]));
  });

  it("delivers part of an order with prices and discount from the order", async () => {
    await opening(noodlesId, 1000);
    await opening(muriId, 100);

    const before = await getOrderForDelivery(adminActor, orderId, TODAY);
    expect(before.lines.map((line) => [line.remaining, line.maxQty])).toEqual([
      [480, 504],
      [200, 200],
    ]);

    const delivery = await createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 240 }, { orderLineId: muriLine, qty: 100 }]));
    expect(delivery).toMatchObject({
      number: "SD-2026-00001",
      challanNo: "CH-2026-00001",
      deliveryType: "SALES_ORDER",
      confirmation: "PENDING",
      orderNumber: "SO-2026-00001",
      itemsTotal: 8174,
      discountAmount: 50,
      totalAmount: 8124,
      deliveryTime: "09:12",
      dueDate: "2026-10-19",
      shippingAddress: "Kalmakanda College Road, Netrokona",
      orderFullyDelivered: false,
      invoiceType: "Due",
    });
    expect(delivery.lines[0]).toMatchObject({ qty: 240, altUom: "CTN", altUomFactor: 24, vatPercent: 15, amount: 3504 });
    expect([await stock(noodlesId), await stock(muriId)]).toEqual([760, 0]);

    const order = await getOrder(adminActor, orderId);
    expect(order.status).toBe("APPROVED");
    expect(order.lines.map((line) => line.deliveredQty)).toEqual([240, 100]);
    expect(order.events.at(-1)?.action).toBe("PARTIALLY_DELIVERED");

    const [approved] = await listApprovedOrders(adminActor, {});
    expect(approved).toMatchObject({ status: "PARTIALLY_DELIVERED", deliveredPercent: 50 });
    expect(await listApprovedOrders(adminActor, { status: "APPROVED" })).toEqual([]);
  });

  it("blocks deliveries beyond stock or the tolerance", async () => {
    await opening(noodlesId, 1000);
    await expect(createDelivery(adminActor, forOrder([{ orderLineId: muriLine, qty: 1 }]))).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Not enough stock"),
    });
    // 480 ordered + 5 % tolerance = 504 at most.
    await expect(createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 505 }]))).rejects.toMatchObject({ status: 409 });
    await createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 504 }]));
    expect(await stock(noodlesId)).toBe(496);
    await expect(
      createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 300 }], { warehouseId: otherOfficeWarehouseId })),
    ).rejects.toMatchObject({ status: 400, message: "The warehouse belongs to another office." });
  });

  it("completes the order on full delivery and re-opens it when the delivery is deleted", async () => {
    await opening(noodlesId, 1000);
    await opening(muriId, 300);
    const delivery = await createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 480 }, { orderLineId: muriLine, qty: 200 }]));
    expect(delivery.orderFullyDelivered).toBe(true);
    expect((await getOrder(adminActor, orderId)).status).toBe("COMPLETED");
    expect(await listApprovedOrders(adminActor, {})).toEqual([]);

    await expect(deleteDelivery(adminActor, delivery.id, { version: delivery.updatedAt })).rejects.toThrow();
    await deleteDelivery(adminActor, delivery.id, { version: delivery.updatedAt, reason: "Wrong customer" });

    const order = await getOrder(adminActor, orderId);
    expect(order.status).toBe("APPROVED");
    expect(order.lines.map((line) => line.deliveredQty)).toEqual([0, 0]);
    expect([await stock(noodlesId), await stock(muriId)]).toEqual([1000, 300]);
    const deleted = await getDelivery(adminActor, delivery.id);
    expect(deleted).toMatchObject({ status: "CANCELLED", deleteReason: "Wrong customer" });
    expect((await listDeliveries(adminActor, { deleted: "true" })).rows.map((row) => row.number)).toEqual([delivery.number]);
    expect((await listDeliveries(adminActor, {})).totalCount).toBe(0);
  });

  it("records payment on delivery as a collection and updates the customer balance", async () => {
    await opening(noodlesId, 1000);
    const delivery = await createDelivery(
      adminActor,
      forOrder([{ orderLineId: noodlesLine, qty: 240 }], { paymentMethod: "CASH", paidAmount: 1000, deliveryCharge: 200 }),
    );
    // 240 × 14.6 = 3504; discount 100 × 3504 / 16348 = 21.43; + 200 delivery charge.
    expect(delivery).toMatchObject({ itemsTotal: 3504, discountAmount: 21.43, totalAmount: 3682.57, paidAmount: 1000 });
    const collections = await prisma.salesCollection.findMany({ where: { deliveryId: delivery.id } });
    expect(collections).toMatchObject([{ number: "CR-2026-00001", status: "SUBMITTED", method: "CASH" }]);
    expect((await getCustomerCredit(adminActor, customerId, TODAY)).outstanding).toBe(2682.57);

    await expect(
      createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 10 }], { paidAmount: 1_000_000 })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("edits pending deliveries with locking; confirmation locks them", async () => {
    await opening(noodlesId, 1000);
    const delivery = await createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 240 }]));
    const edited = await updateDelivery(adminActor, delivery.id, {
      version: delivery.updatedAt,
      data: forOrder([{ orderLineId: noodlesLine, qty: 100 }], { vehicleNo: "DHAKA METRO DA-12-0407", challanNo: "CH-MANUAL-1" }),
    });
    expect(edited).toMatchObject({ number: delivery.number, challanNo: "CH-MANUAL-1", vehicleNo: "DHAKA METRO DA-12-0407", totalQty: 100 });
    expect(await stock(noodlesId)).toBe(900);
    expect((await getOrder(adminActor, orderId)).lines[0].deliveredQty).toBe(100);

    await expect(updateDelivery(adminActor, delivery.id, { version: delivery.updatedAt, data: forOrder([{ orderLineId: noodlesLine, qty: 50 }]) })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Someone else"),
    });

    await expect(confirmDelivery(adminActor, delivery.id, { version: edited.updatedAt, actualDeliveryDate: "2026-10-01" })).rejects.toMatchObject({ status: 400 });
    const confirmed = await confirmDelivery(adminActor, delivery.id, { version: edited.updatedAt, actualDeliveryDate: "2026-10-13" });
    expect(confirmed).toMatchObject({ confirmation: "CONFIRMED", actualDeliveryDate: "2026-10-13", confirmedBy: adminActor.id });
    await expect(
      updateDelivery(adminActor, delivery.id, { version: confirmed.updatedAt, data: forOrder([{ orderLineId: noodlesLine, qty: 50 }]) }),
    ).rejects.toMatchObject({ status: 409, message: "A confirmed delivery cannot be edited." });
    await expect(deleteDelivery(adminActor, delivery.id, { version: confirmed.updatedAt, reason: "x" })).rejects.toMatchObject({ status: 409 });

    // A used challan number cannot be reused.
    await expect(
      createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 10 }], { challanNo: "CH-MANUAL-1" })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("makes direct deliveries and exchanges", async () => {
    await opening(noodlesId, 100);
    const direct = await createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId,
      priceIncludesVat: false,
      discountAmount: 0,
      officeId,
      warehouseId,
      ...header,
      lines: [{ itemId: noodlesId, qty: 10, unitPrice: 15, discountPercent: 0, vatPercent: 15, aitPercent: 0 }],
    });
    expect(direct).toMatchObject({ deliveryType: "DIRECT", orderNumber: null, itemsBase: 150, vatAmount: 22.5, totalAmount: 172.5 });

    const exchange = await createDelivery(adminActor, {
      deliveryType: "EXCHANGE",
      customerId,
      priceIncludesVat: true,
      discountAmount: 0,
      reason: "Damaged packets",
      officeId,
      warehouseId,
      ...header,
      paidAmount: 20,
      receivedLines: [{ itemId: muriId, qty: 10, rate: 46.7 }],
      lines: [{ itemId: noodlesId, qty: 40, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 }],
    });
    expect(exchange.exchangeReturn).toMatchObject({ number: "SR-2026-00001", reason: "Damaged packets", totalAmount: 467 });
    expect([await stock(noodlesId), await stock(muriId)]).toEqual([50, 10]);

    const [row] = (await listDeliveries(adminActor, { deliveryType: "EXCHANGE" })).rows;
    // Given 584 − taken back 467 − paid 20.
    expect(row).toMatchObject({ totalAmount: 584, returnAmount: 467, paidAmount: 20, pendingAmount: 97 });

    await deleteDelivery(adminActor, exchange.id, { version: exchange.updatedAt, reason: "Entered twice" });
    expect([await stock(noodlesId), await stock(muriId)]).toEqual([90, 0]);
    expect((await prisma.salesReturn.findUniqueOrThrow({ where: { id: exchange.exchangeReturn!.id } })).status).toBe("CANCELLED");
  });

  it("filters the delivery list and tracks pending reasons", async () => {
    await opening(noodlesId, 1000);
    await createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 10 }], { vehicleNo: "DHAKA METRO DA-12-0407" }));
    expect((await listDeliveries(adminActor, { vehicleNo: "da-12" })).totalCount).toBe(1);
    expect((await listDeliveries(adminActor, { vehicleNo: "XX" })).totalCount).toBe(0);
    expect((await listDeliveries(adminActor, { confirmation: "CONFIRMED" })).totalCount).toBe(0);
    expect((await listDeliveries(adminActor, { from: "2026-10-13" })).totalCount).toBe(0);
    expect((await listDeliveries(scopedActor([OTHER_COMPANY]), {})).totalCount).toBe(0);

    const reasonId = (await createSetupRecord(adminActor, "delivery-reasons", { businessUnitId, name: "Vehicle not available" })).id;
    await setOrderPendingReason(adminActor, orderId, { reasonId });
    expect((await listApprovedOrders(adminActor, {}))[0].pendingReasonId).toBe(reasonId);
    await setOrderPendingReason(adminActor, orderId, { reasonId: null });
    expect((await listApprovedOrders(adminActor, {}))[0].pendingReasonId).toBeNull();
    await expect(setOrderPendingReason(scopedActor([OTHER_COMPANY]), orderId, { reasonId })).rejects.toMatchObject({ status: 404 });
  });
});
