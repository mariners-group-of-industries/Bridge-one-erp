import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDelivery, deleteDelivery, listDeliveries } from "@/features/sales/deliveries/services/delivery.service";
import { adjustStock, getStockLevels } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createItem, createSetupRecord, getCustomerCredit, getSetupLookups } from "@/features/sales/masters/services/masters.service";
import type { ReferencedReturnInput, WithoutReferenceInput } from "@/features/sales/returns/schemas/return.schema";
import {
  approveReturn,
  createReturn,
  deleteReturn,
  getDeliveryForReturn,
  getReturn,
  listReturnableDeliveries,
  listReturns,
  qcMarketReturn,
  receiveMarketReturn,
  updateReturn,
} from "@/features/sales/returns/services/return.service";
import type { Actor } from "@/lib/auth/actor";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const TODAY = "2026-10-12";
const clerk: Actor = { ...adminActor, id: "test-clerk", permissions: new Set(["sales:read", "sales:write"]) };

describe("sales return", () => {
  let prisma: PrismaClient;
  let businessUnitId: string;
  let officeId: string;
  let warehouseId: string;
  let customerId: string;
  let noodlesId: string;
  let muriId: string;

  const stock = async (itemId: string) => (await getStockLevels(adminActor, warehouseId, [itemId]))[0].qty;

  /** Direct delivery of 240 noodles (VAT 15% inclusive) and 100 puffed rice: 8,174 before discount. */
  async function deliver(discountAmount = 0) {
    return createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId,
      officeId,
      warehouseId,
      priceIncludesVat: true,
      discountAmount,
      deliveryDate: TODAY,
      paymentMethod: "CREDIT",
      paymentTermDays: 7,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 0,
      lines: [
        { itemId: noodlesId, qty: 240, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 },
        { itemId: muriId, qty: 100, unitPrice: 46.7, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
      ],
    });
  }

  const against = (
    deliveryId: string,
    mode: "FULL" | "PARTIAL",
    lines: { deliveryLineId: string; qty: number; reason?: string }[],
  ): ReferencedReturnInput => ({ mode, deliveryId, officeId, warehouseId, returnDate: TODAY, reason: "Good Product Return", lines });

  const withoutReference = (extra: Partial<WithoutReferenceInput> = {}): WithoutReferenceInput => ({
    mode: "WITHOUT_REFERENCE",
    kind: "SALES",
    customerId,
    priceIncludesVat: false,
    withoutInvoice: false,
    officeId,
    warehouseId,
    returnDate: TODAY,
    lines: [{ itemId: noodlesId, qty: 12, rate: 14.6, vatPercent: 15, reason: "Damaged" }],
    ...extra,
  });

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "Finished Goods (FG) WH" } })).id;
    customerId = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7 })).id;
    noodlesId = (await createItem(adminActor, { businessUnitId, name: "Marine Noodles 120 gm (1x24)", uom: "PCS", salesRate: 14.6, vatPercent: 15 })).id;
    muriId = (await createItem(adminActor, { businessUnitId, name: "Marine Puffed Rice 400g", uom: "PCS", salesRate: 46.7 })).id;
    for (const itemId of [noodlesId, muriId]) {
      await adjustStock(adminActor, { warehouseId, itemId, qty: 1000, source: "OPENING", postingDate: TODAY });
    }
  });

  afterAll(stopTestDb);

  it("holds a partial return until approval, then restocks and credits the customer", async () => {
    const delivery = await deliver();
    const [noodles, muri] = delivery.lines;
    expect(await stock(noodlesId)).toBe(760);

    const pending = await createReturn(clerk, against(delivery.id, "PARTIAL", [{ deliveryLineId: noodles.id, qty: 24, reason: "Damaged" }]));
    // The delivery line's own amounts, pro rata: 24 of 240 noodles.
    expect(pending).toMatchObject({ number: "SR-2026-00001", status: "DRAFT", mode: "PARTIAL", kind: "SALES", deliveryNumber: delivery.number });
    expect(pending).toMatchObject({ totalQty: 24, itemsBase: 304.7, vatAmount: 45.7, itemsTotal: 350.4, totalAmount: 350.4 });
    expect(pending.lines[0]).toMatchObject({ itemName: "Marine Noodles 120 gm (1x24)", rate: 14.6, vatPercent: 15, reason: "Damaged" });
    // Pending: no stock or credit yet, but the quantity is held.
    expect(await stock(noodlesId)).toBe(760);
    expect((await getCustomerCredit(adminActor, customerId, TODAY)).outstanding).toBe(8174);
    const left = await getDeliveryForReturn(adminActor, delivery.id);
    expect(left.lines.find((line) => line.deliveryLineId === noodles.id)).toMatchObject({ returnedQty: 24, returnable: 216 });
    await expect(createReturn(clerk, against(delivery.id, "PARTIAL", [{ deliveryLineId: noodles.id, qty: 217 }]))).rejects.toMatchObject({ status: 409 });

    // Only approvers approve.
    await expect(approveReturn(clerk, pending.id, { version: pending.updatedAt })).rejects.toMatchObject({ status: 403 });
    const approved = await approveReturn(adminActor, pending.id, { version: pending.updatedAt });
    expect(approved).toMatchObject({ status: "SUBMITTED", approvedBy: adminActor.id });
    expect(await stock(noodlesId)).toBe(784);
    expect((await getCustomerCredit(adminActor, customerId, TODAY)).outstanding).toBe(7823.6);
    await expect(updateReturn(adminActor, approved.id, { version: approved.updatedAt, data: against(delivery.id, "PARTIAL", [{ deliveryLineId: noodles.id, qty: 1 }]) })).rejects.toMatchObject({ status: 409 });

    // Delivery List tab and the delivery list reflect it; a full return is no longer possible.
    const rows = await listReturnableDeliveries(adminActor, { from: TODAY, to: TODAY });
    expect(rows[0]).toMatchObject({ number: delivery.number, deliveredQty: 340, returnedQty: 24 });
    expect((await listDeliveries(adminActor, {})).rows[0]).toMatchObject({ returnAmount: 350.4, pendingAmount: 7823.6 });
    const fullLines = [{ deliveryLineId: noodles.id, qty: 216 }, { deliveryLineId: muri.id, qty: 100 }];
    await expect(createReturn(clerk, against(delivery.id, "FULL", fullLines))).rejects.toMatchObject({ status: 409 });

    // A delivery with returns cannot be deleted.
    await expect(deleteDelivery(adminActor, delivery.id, { version: delivery.updatedAt, reason: "Wrong" })).rejects.toMatchObject({ status: 409 });
  });

  it("takes everything back on a full return, including its share of the discount", async () => {
    const delivery = await deliver(174);
    expect(delivery.totalAmount).toBe(8000);
    const [noodles, muri] = delivery.lines;
    await expect(createReturn(clerk, against(delivery.id, "FULL", [{ deliveryLineId: noodles.id, qty: 240 }]))).rejects.toMatchObject({ status: 400 });

    const full = await createReturn(clerk, against(delivery.id, "FULL", [{ deliveryLineId: noodles.id, qty: 240 }, { deliveryLineId: muri.id, qty: 100 }]));
    expect(full).toMatchObject({ mode: "FULL", itemsTotal: 8174, discountAmount: 174, totalAmount: 8000 });
    await approveReturn(adminActor, full.id, { version: full.updatedAt });
    expect(await stock(noodlesId)).toBe(1000);
    expect(await stock(muriId)).toBe(1000);
    expect((await getCustomerCredit(adminActor, customerId, TODAY)).outstanding).toBe(0);
    await expect(createReturn(clerk, against(delivery.id, "PARTIAL", [{ deliveryLineId: muri.id, qty: 1 }]))).rejects.toMatchObject({ status: 409 });
  });

  it("edits pending returns and deletes returns, reversing stock only if it is still there", async () => {
    const delivery = await deliver();
    const noodles = delivery.lines[0];
    const pending = await createReturn(clerk, against(delivery.id, "PARTIAL", [{ deliveryLineId: noodles.id, qty: 24 }]));
    const edited = await updateReturn(clerk, pending.id, { version: pending.updatedAt, data: against(delivery.id, "PARTIAL", [{ deliveryLineId: noodles.id, qty: 240 }]) });
    expect(edited.totalQty).toBe(240);
    await expect(updateReturn(clerk, pending.id, { version: pending.updatedAt, data: against(delivery.id, "PARTIAL", [{ deliveryLineId: noodles.id, qty: 1 }]) })).rejects.toMatchObject({ status: 409 });

    // Deleting a pending return frees its quantity.
    await deleteReturn(clerk, edited.id, { version: edited.updatedAt, reason: "Entered twice" });
    expect((await getReturn(adminActor, edited.id)).status).toBe("CANCELLED");
    expect((await getDeliveryForReturn(adminActor, delivery.id)).lines[0].returnable).toBe(240);
    expect((await listReturns(adminActor, {})).rows).toHaveLength(0);
    expect((await listReturns(adminActor, { status: "CANCELLED" })).rows).toHaveLength(1);

    // An approved return: only approvers delete it, and its goods must still be in stock.
    const second = await createReturn(clerk, against(delivery.id, "PARTIAL", [{ deliveryLineId: noodles.id, qty: 100 }]));
    const approved = await approveReturn(adminActor, second.id, { version: second.updatedAt });
    expect(await stock(noodlesId)).toBe(860);
    await expect(deleteReturn(clerk, approved.id, { version: approved.updatedAt, reason: "Wrong" })).rejects.toMatchObject({ status: 403 });
    await adjustStock(adminActor, { warehouseId, itemId: noodlesId, qty: -800, source: "ADJUSTMENT", postingDate: TODAY });
    await expect(deleteReturn(adminActor, approved.id, { version: approved.updatedAt, reason: "Wrong" })).rejects.toMatchObject({ status: 400 });
    await adjustStock(adminActor, { warehouseId, itemId: noodlesId, qty: 800, source: "ADJUSTMENT", postingDate: TODAY });
    await deleteReturn(adminActor, approved.id, { version: approved.updatedAt, reason: "Wrong" });
    expect(await stock(noodlesId)).toBe(760);
    expect((await getCustomerCredit(adminActor, customerId, TODAY)).outstanding).toBe(8174);
  });

  it("prices returns without reference and drops VAT when the customer has no invoice", async () => {
    const exclusive = await createReturn(clerk, withoutReference());
    expect(exclusive).toMatchObject({ mode: "WITHOUT_REFERENCE", deliveryId: null, itemsBase: 175.2, vatAmount: 26.28, totalAmount: 201.48 });
    const noInvoice = await createReturn(clerk, withoutReference({ withoutInvoice: true, priceIncludesVat: true }));
    expect(noInvoice).toMatchObject({ vatAmount: 0, totalAmount: 175.2, withoutInvoice: true });
    expect(noInvoice.lines[0].vatPercent).toBe(0);
    await approveReturn(adminActor, exclusive.id, { version: exclusive.updatedAt });
    expect(await stock(noodlesId)).toBe(1012);
  });

  it("puts a market return into stock only after factory receipt and QC", async () => {
    const market = await createReturn(clerk, withoutReference({ kind: "MARKET" }));
    expect(market).toMatchObject({ number: "MR-2026-00001", kind: "MARKET", marketStage: "PENDING" });
    const line = market.lines[0].id;
    await expect(receiveMarketReturn(clerk, market.id, { version: market.updatedAt, lines: [{ lineId: line, qty: 12 }] })).rejects.toMatchObject({ status: 409 });

    const approved = await approveReturn(adminActor, market.id, { version: market.updatedAt });
    expect(approved.marketStage).toBe("APPROVED");
    expect(await stock(noodlesId)).toBe(1000);
    await expect(qcMarketReturn(clerk, market.id, { version: approved.updatedAt, lines: [{ lineId: line, qty: 1 }] })).rejects.toMatchObject({ status: 409 });
    await expect(receiveMarketReturn(clerk, market.id, { version: approved.updatedAt, lines: [{ lineId: line, qty: 13 }] })).rejects.toMatchObject({ status: 400 });

    const received = await receiveMarketReturn(clerk, market.id, { version: approved.updatedAt, lines: [{ lineId: line, qty: 10 }] });
    expect(received).toMatchObject({ marketStage: "FACTORY_RECEIVED", factoryReceivedBy: clerk.id });
    await expect(qcMarketReturn(clerk, market.id, { version: received.updatedAt, lines: [{ lineId: line, qty: 11 }] })).rejects.toMatchObject({ status: 400 });
    const checked = await qcMarketReturn(clerk, market.id, { version: received.updatedAt, lines: [{ lineId: line, qty: 8 }] });
    expect(checked.marketStage).toBe("QC_DONE");
    expect(await stock(noodlesId)).toBe(1008);

    const list = await listReturns(adminActor, { kind: "MARKET" });
    expect(list.rows[0]).toMatchObject({ totalQty: 12, receivedQty: 10, qcQty: 8, marketStage: "QC_DONE" });
    expect((await listReturns(adminActor, { kind: "SALES" })).rows).toHaveLength(0);
  });

  it("keeps return reasons as a setup list and scopes returns to the company", async () => {
    await createSetupRecord(adminActor, "return-reasons", { businessUnitId, name: "Good Product Return" });
    expect((await getSetupLookups(adminActor, businessUnitId)).returnReasons.map((reason) => reason.name)).toEqual(["Good Product Return"]);

    const created = await createReturn(clerk, withoutReference());
    await expect(getReturn(scopedActor([OTHER_COMPANY]), created.id)).rejects.toMatchObject({ status: 404 });
    expect((await listReturns(scopedActor([OTHER_COMPANY]), {})).rows).toHaveLength(0);
  });
});
