import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { DeliveryInput, OrderDeliveryInput } from "@/features/sales/deliveries/schemas/delivery.schema";
import { createCollection } from "@/features/sales/collections/services/collection.service";
import { deliveryChallanPdf, deliveryTabExcel } from "@/features/sales/deliveries/services/delivery-export";
import { createVehicle, listVehicles, searchDrivers } from "@/features/sales/deliveries/services/vehicle.service";
import {
  addPendingNote,
  confirmDelivery,
  createDelivery,
  deleteDelivery,
  getDelivery,
  getOrderForDelivery,
  listApprovedOrders,
  listDeliveries,
  listPendingNotes,
  setOrderPendingReason,
  updateDelivery,
  updateDeliveryReferences,
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
      number: "SD-MG260000001",
      challanNo: "CH-MG260000001",
      deliveryType: "SALES_ORDER",
      confirmation: "PENDING",
      orderNumber: "SO-MG260000001",
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
    expect(collections).toMatchObject([{ number: "CR-MG260000001", status: "SUBMITTED", method: "CASH" }]);
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
    expect(exchange.exchangeReturn).toMatchObject({ number: "SRE-MG260000001", reason: "Damaged packets", totalAmount: 467 });
    expect((await prisma.salesReturn.findUniqueOrThrow({ where: { id: exchange.exchangeReturn!.id } })).mode).toBe("EXCHANGE");
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

  it("registers vehicles with compartments and a driver, and carries them on a walk-in direct delivery", async () => {
    await opening(noodlesId, 100);
    const driver = await prisma.employee.create({
      data: { officeId, employeeCode: "E-101", name: "Md. Rakib Driver", mobile: "01711000000", joiningDate: new Date("2025-01-01") },
    });
    expect((await searchDrivers(adminActor, { businessUnitId, search: "rak" })).map((row) => row.name)).toEqual(["Md. Rakib Driver"]);
    await expect(searchDrivers(adminActor, { businessUnitId, search: "ra" })).rejects.toThrow();

    const vehicle = await createVehicle(adminActor, {
      businessUnitId,
      vehicleNumber: "DHAKA METRO-TA 11-2233",
      vehicleSize: "3 Ton",
      isRent: true,
      isCargo: false,
      driverEmployeeId: driver.id,
      securityCode: "4455",
      compartments: [
        { compartmentType: "Chamber", compartmentName: "Front", capacity: 1500, uom: "Litre" },
        { compartmentType: "Chamber", compartmentName: "Rear", capacity: 2000, uom: "Litre" },
      ],
    });
    expect(vehicle).toMatchObject({ driverEmployeeName: "Md. Rakib Driver", compartments: [{ compartmentNo: 1 }, { compartmentNo: 2, capacity: 2000 }] });
    await expect(createVehicle(adminActor, { businessUnitId, vehicleNumber: "dhaka metro-ta 11-2233", isRent: false, isCargo: false, compartments: [] })).rejects.toMatchObject({ status: 409 });
    expect(await listVehicles(scopedActor([OTHER_COMPANY]))).toEqual([]);

    const walkIn = await createCustomer(adminActor, { businessUnitId, name: "Anonymous", creditDays: 0, addresses: [] });
    await prisma.customer.update({ where: { id: walkIn.id }, data: { isAnonymous: true } });
    const direct = await createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId: walkIn.id,
      priceIncludesVat: true,
      discountAmount: 0,
      officeId,
      warehouseId,
      ...header,
      vehicleId: vehicle.id,
      vehicleNo: "typed number is replaced",
      driverEmployeeId: driver.id,
      securityCode: "4455",
      referredBy: "Sujon and Polash Enterprise",
      buyerName: "Karim Mia",
      buyerMobile: "01811000000",
      salesType: "SAMPLE",
      lines: [{ itemId: noodlesId, qty: 24, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 }],
    });
    expect(direct).toMatchObject({
      vehicleId: vehicle.id,
      vehicleNo: "DHAKA METRO-TA 11-2233",
      driverEmployeeName: "Md. Rakib Driver",
      buyerName: "Karim Mia",
      buyerMobile: "01811000000",
      referredBy: "Sujon and Polash Enterprise",
      salesType: "SAMPLE",
    });
    expect((await listDeliveries(adminActor, { search: "karim" })).rows.map((row) => row.id)).toEqual([direct.id]);

    const otherUnit = (await prisma.businessUnit.create({ data: { ...businessUnitInput, name: "Other BU", companyId: (await prisma.businessUnit.findUniqueOrThrow({ where: { id: businessUnitId } })).companyId } })).id;
    const foreignVehicle = await createVehicle(adminActor, { businessUnitId: otherUnit, vehicleNumber: "X-1", isRent: false, isCargo: false, compartments: [] });
    await expect(
      createDelivery(adminActor, {
        deliveryType: "DIRECT",
        customerId,
        priceIncludesVat: true,
        discountAmount: 0,
        officeId,
        warehouseId,
        ...header,
        vehicleId: foreignVehicle.id,
        lines: [{ itemId: noodlesId, qty: 1, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("keeps the history of pending reasons, searches and exports the tabs", async () => {
    const first = await addPendingNote(adminActor, orderId, { reason: "Review" });
    expect(first.map((note) => note.reason)).toEqual(["Review"]);
    await addPendingNote(adminActor, orderId, { reason: "All products are not available" });
    await addPendingNote(adminActor, orderId, { reason: "review" });
    expect((await listPendingNotes(adminActor, orderId)).map((note) => note.reason)).toEqual(["Review", "All products are not available", "review"]);
    // The same text reuses one reason of the business unit.
    expect(await prisma.deliveryPendingReason.count({ where: { businessUnitId } })).toBe(2);
    const [row] = await listApprovedOrders(adminActor, { search: "sujon" });
    expect(row).toMatchObject({ id: orderId, pendingReasonName: "Review" });
    expect(await listApprovedOrders(adminActor, { search: "nobody" })).toEqual([]);
    await expect(addPendingNote(adminActor, orderId, { reason: "  " })).rejects.toThrow();
    await expect(listPendingNotes(scopedActor([OTHER_COMPANY]), orderId)).rejects.toMatchObject({ status: 404 });

    const pk = (bytes: Uint8Array) => Buffer.from(bytes.slice(0, 2)).toString();
    expect(pk(await deliveryTabExcel(adminActor, "approved", {}))).toBe("PK");
    expect(pk(await deliveryTabExcel(adminActor, "deliveries", { from: TODAY, to: TODAY }))).toBe("PK");
  });

  it("pages the list, filters by customer, edits references until confirmation and prints the challan", async () => {
    await opening(noodlesId, 1000);
    const direct = (qty: number) =>
      createDelivery(adminActor, {
        deliveryType: "DIRECT",
        customerId,
        priceIncludesVat: true,
        discountAmount: 0,
        officeId,
        warehouseId,
        ...header,
        paidAmount: 0,
        lines: [{ itemId: noodlesId, qty, unitPrice: 10, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
      });
    const created = [];
    for (const qty of [24, 48, 72]) created.push(await direct(qty));
    expect(created.map((row) => row.number)).toEqual(["SD-MG260000001", "SD-MG260000002", "SD-MG260000003"]);
    expect(created[0].challanNo).toBe("CH-MG260000001");

    const page = await listDeliveries(adminActor, { page: 2, pageSize: 25 });
    expect(page).toMatchObject({ totalCount: 3, rows: [] });
    expect((await listDeliveries(adminActor, { page: 1, pageSize: 25 })).rows).toHaveLength(3);
    expect((await listDeliveries(adminActor, { customerId })).totalCount).toBe(3);
    await expect(listDeliveries(adminActor, { page: 1, pageSize: 7 })).rejects.toThrow();

    const detail = await getDelivery(adminActor, created[2].id);
    // 1000 opening − 24 − 48 − 72 delivered.
    expect(detail.lines[0]).toMatchObject({ qty: 72, returnedQty: 0, stock: 856 });
    expect(detail).toMatchObject({ totalAmount: 720, returnAmount: 0, pendingAmount: 720 });

    const edited = await updateDeliveryReferences(adminActor, detail.id, {
      version: detail.updatedAt,
      vatChallanNo: "VAT-77",
      refCustomerPo: "PO-9",
      refCustomerPoDate: TODAY,
      refInvoice: null,
      remarks: "Leave at gate",
    });
    expect(edited).toMatchObject({ vatChallanNo: "VAT-77", refCustomerPo: "PO-9", refCustomerPoDate: TODAY, remarks: "Leave at gate" });
    await expect(updateDeliveryReferences(adminActor, detail.id, { version: detail.updatedAt, vatChallanNo: "late" })).rejects.toMatchObject({ status: 409 });
    const confirmed = await confirmDelivery(adminActor, detail.id, { version: edited.updatedAt, actualDeliveryDate: TODAY });
    await expect(updateDeliveryReferences(adminActor, detail.id, { version: confirmed.updatedAt, vatChallanNo: "x" })).rejects.toMatchObject({ status: 409 });

    const pdf = await deliveryChallanPdf(adminActor, detail.id);
    expect(pdf.number).toBe("CH-MG260000003");
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("shows the signed ledger balance on Delivery From SO (an advance makes it negative)", async () => {
    expect((await getOrderForDelivery(adminActor, orderId, TODAY)).ledgerBalance).toBe(0);
    await createCollection(adminActor, { kind: "ADVANCE", officeId, customerId, collectionDate: TODAY, method: "CASH", amount: 5000 });
    expect((await getOrderForDelivery(adminActor, orderId, TODAY)).ledgerBalance).toBe(-5000);
    await opening(noodlesId, 1000);
    const delivery = await createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 100 }]));
    // The delivery counts against the 5,000 advance.
    expect((await getOrderForDelivery(adminActor, orderId, TODAY)).ledgerBalance).toBeCloseTo(-5000 + delivery.totalAmount, 2);
  });

  it("returns goods while confirming a delivery (Return QTY on Delivery Confirmation)", async () => {
    await opening(noodlesId, 1000);
    const delivery = await createDelivery(adminActor, forOrder([{ orderLineId: noodlesLine, qty: 100 }]));
    const lineId = delivery.lines[0].id;
    // Too much back: nothing is confirmed and no return is left behind.
    await expect(confirmDelivery(adminActor, delivery.id, { version: delivery.updatedAt, actualDeliveryDate: TODAY, returns: [{ deliveryLineId: lineId, qty: 101 }] })).rejects.toThrow();
    expect((await getDelivery(adminActor, delivery.id)).confirmation).toBe("PENDING");
    expect(await prisma.salesReturn.count({ where: { deliveryId: delivery.id } })).toBe(0);

    const confirmed = await confirmDelivery(adminActor, delivery.id, { version: delivery.updatedAt, actualDeliveryDate: TODAY, returns: [{ deliveryLineId: lineId, qty: 10 }] });
    expect(confirmed).toMatchObject({ confirmation: "CONFIRMED" });
    expect(confirmed.lines[0].returnedQty).toBe(10);
    expect(await stock(noodlesId)).toBe(910);
    const back = await prisma.salesReturn.findFirstOrThrow({ where: { deliveryId: delivery.id } });
    expect(back).toMatchObject({ mode: "PARTIAL", status: "SUBMITTED" });
    expect(confirmed.pendingAmount).toBeCloseTo(confirmed.totalAmount - Number(back.totalAmount), 2);
  });
});
