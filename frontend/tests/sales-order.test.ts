import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { amountInWords } from "@/features/sales/lib/amount-in-words";
import {
  createCustomer,
  createItem,
  createSalesPerson,
  createSetupRecord,
  deleteSetupRecord,
  getCustomerCredit,
  getItemPendingQty,
  getSetupLookups,
  updateCustomer,
  updateItem,
} from "@/features/sales/masters/services/masters.service";
import { altQty, orderTotals } from "@/features/sales/orders/lib/order-totals";
import type { OrderInput } from "@/features/sales/orders/schemas/order.schema";
import {
  changeOrderStatus,
  createOrder,
  deleteOrder,
  getOrder,
  listOrders,
  updateOrder,
} from "@/features/sales/orders/services/order.service";
import { changeQuotationStatus, createQuotation, getQuotation } from "@/features/sales/quotations/services/quotation.service";
import type { Actor } from "@/lib/auth/actor";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});


const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const TODAY = "2026-10-11";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("orderTotals", () => {
  const lines = [
    { qty: 480, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 },
    { qty: 200, unitPrice: 46.7, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
  ];

  it("carves VAT out of VAT-inclusive prices", () => {
    const totals = orderTotals(lines, { priceIncludesVat: true, discountAmount: 0, deliveryCharge: 0, unloadingCharge: 0 });
    expect(totals.lines[0]).toMatchObject({ grossAmount: 7008, lineTotal: 7008, baseAmount: 6093.91, vatAmount: 914.09, aitAmount: 0 });
    expect(totals).toMatchObject({ totalQty: 680, itemsTotal: 16348, itemsBase: 15433.91, vatAmount: 914.09, salesTotal: 16348 });
  });

  it("adds VAT and AIT on top of exclusive prices, then discount and charges", () => {
    const totals = orderTotals(
      [{ qty: 10, unitPrice: 100, discountPercent: 10, vatPercent: 15, aitPercent: 2 }],
      { priceIncludesVat: false, discountAmount: 53, deliveryCharge: 100, unloadingCharge: 50 },
    );
    expect(totals.lines[0]).toMatchObject({ grossAmount: 1000, netUnitPrice: 90, baseAmount: 900, vatAmount: 135, aitAmount: 18, lineTotal: 1053 });
    expect(totals.salesTotal).toBe(1053 - 53 + 150);
  });

  it("never lets rounding push AIT below zero (VAT-inclusive)", () => {
    const [line] = orderTotals([{ qty: 100, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 }], {
      priceIncludesVat: true,
      discountAmount: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
    }).lines;
    expect(line).toMatchObject({ lineTotal: 1460, baseAmount: 1269.57, vatAmount: 190.43, aitAmount: 0 });
  });

  it("converts to the alt. unit", () => {
    expect(altQty(480, 24)).toBe(20);
    expect(altQty(200, null)).toBeNull();
  });
});

describe("amountInWords", () => {
  it("uses crore and lakh with paisa", () => {
    expect(amountInWords(64827.28)).toBe("Sixty Four Thousand Eight Hundred Twenty Seven Taka and Twenty Eight Paisa Only");
    expect(amountInWords(21_60_711.57)).toBe(
      "Twenty One Lakh Sixty Thousand Seven Hundred Eleven Taka and Fifty Seven Paisa Only",
    );
    expect(amountInWords(12_34_56_789)).toBe("Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Taka Only");
    expect(amountInWords(0)).toBe("Zero Taka Only");
  });
});

describe("sales orders", () => {
  let prisma: PrismaClient;
  let companyId: string;
  let businessUnitId: string;
  let officeId: string;
  let customerId: string;
  let salesPersonId: string;
  let noodlesId: string;
  let muriId: string;
  let priceListId: string;
  let territoryId: string;
  let shipToId: string;

  const input = (overrides: Partial<OrderInput> = {}): OrderInput => ({
    officeId,
    customerId,
    salesPersonId,
    priceListId,
    shipToAddressId: shipToId,
    orderType: "SALES",
    paymentMethod: "CREDIT",
    orderDate: TODAY,
    expectedDeliveryDate: TODAY,
    priceIncludesVat: true,
    isForeign: false,
    paymentTermDays: 0,
    dueLimit: 0,
    discountAmount: 0,
    deliveryCharge: 0,
    unloadingCharge: 0,
    lines: [
      { itemId: noodlesId, qty: 480, unitPrice: 14.6, discountPercent: 0, vatPercent: 15, aitPercent: 0 },
      { itemId: muriId, qty: 200, unitPrice: 46.7, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
    ],
    ...overrides,
  });
  const act = (actor: Actor, id: string, version: string, action: "submit" | "approve" | "reject" | "cancel" | "complete", remarks?: string) =>
    changeOrderStatus(actor, id, { action, version, remarks, today: TODAY });

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    companyId = (await prisma.company.create({ data: companyInput })).id;
    businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;

    const bu = { businessUnitId };
    territoryId = (await createSetupRecord(adminActor, "areas", { ...bu, kind: "TERRITORY", name: "Nabinagar" })).id;
    const groupId = (await createSetupRecord(adminActor, "customer-groups", { ...bu, name: "Tangail Region" })).id;
    priceListId = (await createSetupRecord(adminActor, "price-lists", { ...bu, name: "Dealer Price", isDefault: true })).id;
    const categoryId = (await createSetupRecord(adminActor, "categories", { ...bu, name: "Noodles" })).id;

    salesPersonId = (await createSalesPerson(adminActor, { ...bu, name: "TSM Azharul Islam", designation: "TSM" })).id;
    const customer = await createCustomer(adminActor, {
      ...bu,
      name: "M/S Sadia Enterprise-Sherpur",
      phone: "01877913566",
      address: "Panaitapara More, Nabinagar, Sherpur",
      customerGroupId: groupId,
      territoryId,
      creditDays: 0,
      creditLimit: null,
      addresses: [{ label: "Shop", address: "Panaitapara More, Nabinagar, Sherpur, Tangail", isDefault: true }],
    });
    customerId = customer.id;
    shipToId = customer.addresses[0].id;
    noodlesId = (
      await createItem(adminActor, {
        ...bu,
        name: "Marine Noodles 120 gm (1x24)",
        uom: "PCS",
        salesRate: 15,
        vatPercent: 15,
        altUom: "CTN",
        altUomFactor: 24,
        categoryId,
        prices: [{ priceListId, rate: 14.6 }],
      })
    ).id;
    muriId = (await createItem(adminActor, { ...bu, name: "Marine Puffed Rice (Muri) 400g", uom: "PCS", salesRate: 46.7 })).id;
  });

  afterAll(stopTestDb);

  describe("setup masters", () => {
    it("lists setup records and refuses to delete ones in use", async () => {
      const lookups = await getSetupLookups(adminActor, businessUnitId);
      expect(lookups.areas.map((area) => [area.kind, area.name])).toEqual([["TERRITORY", "Nabinagar"]]);
      expect(lookups.priceLists).toMatchObject([{ name: "Dealer Price", isDefault: true }]);
      await expect(deleteSetupRecord(adminActor, "areas", territoryId)).rejects.toMatchObject({ status: 409 });

      // A second default price type takes the default over.
      await createSetupRecord(adminActor, "price-lists", { businessUnitId, name: "Retail Price", isDefault: true });
      const after = await getSetupLookups(adminActor, businessUnitId);
      expect(after.priceLists.filter((list) => list.isDefault).map((list) => list.name)).toEqual(["Retail Price"]);
    });

    it("limits categories to three levels", async () => {
      const root = (await createSetupRecord(adminActor, "categories", { businessUnitId, name: "Snacks" })).id;
      const sub = (await createSetupRecord(adminActor, "categories", { businessUnitId, parentId: root, name: "Chanachur" })).id;
      const minor = (await createSetupRecord(adminActor, "categories", { businessUnitId, parentId: sub, name: "12gm" })).id;
      await expect(createSetupRecord(adminActor, "categories", { businessUnitId, parentId: minor, name: "Too deep" })).rejects.toMatchObject({
        status: 400,
      });
    });

    it("rejects references from another business unit and keeps one default address", async () => {
      const otherUnit = (await prisma.businessUnit.create({ data: { ...businessUnitInput, name: "Other", companyId } })).id;
      const foreignArea = (await createSetupRecord(adminActor, "areas", { businessUnitId: otherUnit, kind: "TERRITORY", name: "X" })).id;
      await expect(
        createCustomer(adminActor, { businessUnitId, name: "Bad", creditDays: 0, territoryId: foreignArea }),
      ).rejects.toMatchObject({ status: 400 });

      const updated = await updateCustomer(adminActor, customerId, {
        name: "M/S Sadia Enterprise-Sherpur",
        creditDays: 7,
        addresses: [
          { id: shipToId, label: "Shop", address: "Panaitapara More", isDefault: false },
          { label: "Godown", address: "Sherpur Bazar", isDefault: true },
        ],
      });
      expect(updated.addresses.map((address) => [address.label, address.isDefault])).toEqual([
        ["Godown", true],
        ["Shop", false],
      ]);
    });

    it("replaces item prices on update", async () => {
      const item = await updateItem(adminActor, noodlesId, {
        name: "Marine Noodles 120 gm (1x24)",
        uom: "PCS",
        salesRate: 15,
        altUom: "CTN",
        altUomFactor: 24,
        prices: [{ priceListId, rate: 14.9 }],
      });
      expect(item.prices).toEqual({ [priceListId]: 14.9 });
      await expect(
        updateItem(adminActor, noodlesId, { name: "x", uom: "PCS", salesRate: 1, altUom: "CTN", altUomFactor: null }),
      ).rejects.toThrow();
    });
  });

  it("creates a draft with server-computed totals, snapshots and history", async () => {
    const order = await createOrder(adminActor, { ...input(), shippingAddress: "ignored when an address is chosen" });
    expect(order).toMatchObject({
      number: "SO-2026-00001",
      status: "DRAFT",
      customerName: "M/S Sadia Enterprise-Sherpur",
      territory: "Nabinagar",
      customerGroup: "Tangail Region",
      priceListName: "Dealer Price",
      shippingAddress: "Panaitapara More, Nabinagar, Sherpur, Tangail",
      billingAddress: "Panaitapara More, Nabinagar, Sherpur",
      totalQty: 680,
      itemsTotal: 16348,
      vatAmount: 914.09,
      salesTotal: 16348,
    });
    expect(order.lines[0]).toMatchObject({ itemName: "Marine Noodles 120 gm (1x24)", uom: "PCS", altUom: "CTN", altUomFactor: 24, lineTotal: 7008 });
    expect(order.events.map((event) => event.action)).toEqual(["CREATED"]);
  });

  it("approves cash and within-limit orders automatically", async () => {
    const cash = await createOrder(adminActor, input({ paymentMethod: "CASH" }));
    const approved = await act(adminActor, cash.id, cash.updatedAt, "submit");
    expect(approved).toMatchObject({ status: "APPROVED", holdReason: null });
    expect(approved.approvedAt).not.toBeNull();
    expect(approved.events.at(-1)).toMatchObject({ action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "APPROVED" });
    expect(await getItemPendingQty(adminActor, noodlesId)).toBe(480);
  });

  it("holds credit orders over the limit, then approve / reject work with the approve permission", async () => {
    await prisma.customer.update({ where: { id: customerId }, data: { creditLimit: 20000 } });
    // An earlier approved order (16,348) already uses most of the limit.
    const first = await createOrder(adminActor, input());
    await act(adminActor, first.id, first.updatedAt, "submit");
    expect((await getCustomerCredit(adminActor, customerId, TODAY)).available).toBe(20000 - 16348);

    let order = await createOrder(adminActor, input());
    order = await act(adminActor, order.id, order.updatedAt, "submit");
    expect(order).toMatchObject({ status: "PENDING_APPROVAL", holdReason: "CREDIT_LIMIT_EXCEEDED" });
    expect(order.events.at(-1)?.remarks).toContain("exceeds the credit limit");

    const noApprover: Actor = { ...adminActor, permissions: new Set(["sales:read", "sales:write"]) };
    await expect(act(noApprover, order.id, order.updatedAt, "approve")).rejects.toMatchObject({ status: 403 });
    await expect(act(adminActor, order.id, order.updatedAt, "reject")).rejects.toMatchObject({ status: 400 });

    order = await act(adminActor, order.id, order.updatedAt, "reject", "Collect dues first");
    expect(order).toMatchObject({ status: "DRAFT", holdReason: null });
    order = await act(adminActor, order.id, order.updatedAt, "submit");
    order = await act(adminActor, order.id, order.updatedAt, "approve", "Approved by RSM");
    expect(order).toMatchObject({ status: "APPROVED", holdReason: null });
    expect(order.events.map((event) => event.action)).toEqual([
      "CREATED",
      "SUBMITTED_FOR_APPROVAL",
      "REJECTED",
      "SUBMITTED_FOR_APPROVAL",
      "APPROVED",
    ]);
  });

  it("holds credit orders of customers with overdue dues", async () => {
    await prisma.salesDelivery.create({
      data: {
        businessUnitId,
        number: "D-1",
        customerId,
        deliveryDate: day("2026-09-01"),
        dueDate: day("2026-09-15"),
        status: "SUBMITTED",
        totalAmount: 5000,
      },
    });
    expect(await getCustomerCredit(adminActor, customerId, TODAY)).toMatchObject({ overdue: 5000, outstanding: 5000, available: null });
    const order = await createOrder(adminActor, input());
    expect(await act(adminActor, order.id, order.updatedAt, "submit")).toMatchObject({
      status: "PENDING_APPROVAL",
      holdReason: "OVERDUE_BALANCE",
    });
  });

  it("edits drafts only, with optimistic locking, and requires remarks to cancel or close", async () => {
    const draft = await createOrder(adminActor, input());
    const edited = await updateOrder(adminActor, draft.id, {
      version: draft.updatedAt,
      data: input({ priceIncludesVat: false, deliveryCharge: 200, lines: [input().lines[0]] }),
    });
    expect(edited).toMatchObject({ itemsTotal: 8059.2, salesTotal: 8259.2 });
    await expect(updateOrder(adminActor, draft.id, { version: draft.updatedAt, data: input() })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Someone else"),
    });

    const approved = await act(adminActor, draft.id, edited.updatedAt, "submit");
    await expect(updateOrder(adminActor, draft.id, { version: approved.updatedAt, data: input() })).rejects.toMatchObject({ status: 409 });
    await expect(deleteOrder(adminActor, draft.id)).rejects.toMatchObject({ status: 409 });
    await expect(act(adminActor, draft.id, approved.updatedAt, "complete")).rejects.toMatchObject({ status: 400 });
    const closed = await act(adminActor, draft.id, approved.updatedAt, "complete", "Customer short-closed");
    expect(closed.status).toBe("COMPLETED");
    await expect(act(adminActor, draft.id, closed.updatedAt, "cancel", "late")).rejects.toMatchObject({ status: 409 });
  });

  it("turns a submitted quotation into an order and releases it on cancel", async () => {
    let quotation = await createQuotation(adminActor, {
      officeId,
      customerId,
      quotationDate: TODAY,
      validTill: "2026-10-20",
      discountAmount: 0,
      vatPercent: 0,
      lines: [{ itemId: muriId, qty: 10, rate: 46.7, discountPercent: 0 }],
    });
    await expect(createOrder(adminActor, input({ quotationId: quotation.id }))).rejects.toMatchObject({ status: 409 });
    quotation = await changeQuotationStatus(adminActor, quotation.id, { action: "submit", version: quotation.updatedAt });

    const order = await createOrder(adminActor, input({ quotationId: quotation.id, paymentMethod: "CASH" }));
    expect(order.quotationNumber).toBe(quotation.number);
    expect((await getQuotation(adminActor, quotation.id)).status).toBe("ORDERED");
    await expect(createOrder(adminActor, input({ quotationId: quotation.id }))).rejects.toMatchObject({ status: 409 });

    const approved = await act(adminActor, order.id, order.updatedAt, "submit");
    await act(adminActor, order.id, approved.updatedAt, "cancel", "Customer withdrew");
    expect((await getQuotation(adminActor, quotation.id)).status).toBe("SUBMITTED");
  });

  it("filters the list and totals every match", async () => {
    const a = await createOrder(adminActor, input());
    await createOrder(adminActor, input({ paymentMethod: "CASH", orderDate: "2026-10-05", expectedDeliveryDate: "2026-10-06" }));
    await act(adminActor, a.id, a.updatedAt, "submit");

    const all = await listOrders(adminActor, {});
    expect(all.totalCount).toBe(2);
    expect(all.totalAmount).toBe(32696);
    expect(all.rows[0]).toMatchObject({ number: "SO-2026-00001", territory: "Nabinagar", salesPersonName: "TSM Azharul Islam" });
    expect((await listOrders(adminActor, { status: "APPROVED" })).rows.map((row) => row.number)).toEqual(["SO-2026-00001"]);
    expect((await listOrders(adminActor, { paymentMethod: "CASH" })).totalCount).toBe(1);
    expect((await listOrders(adminActor, { from: "2026-10-10" })).totalCount).toBe(1);
    expect((await listOrders(adminActor, { territoryId })).totalCount).toBe(2);
    expect((await listOrders(scopedActor([OTHER_COMPANY]), {})).totalCount).toBe(0);
    await expect(getOrder(scopedActor([OTHER_COMPANY]), a.id)).rejects.toMatchObject({ status: 404 });
  });

  it("shows people by name and filters by who entered the order and its pending reason", async () => {
    const user = await prisma.user.create({ data: { name: "Md. Manik Miah", phone: "01700000001", passwordHash: "x" } });
    const clerk: Actor = { ...adminActor, id: user.id };
    const draft = await createOrder(clerk, input());
    const approved = await act(clerk, draft.id, draft.updatedAt, "submit");
    expect(approved).toMatchObject({ status: "APPROVED", createdByName: "Md. Manik Miah", updatedByName: "Md. Manik Miah" });
    expect(approved.events.at(-1)).toMatchObject({ actorId: user.id, actorName: "Md. Manik Miah" });
    // Ids that are not users (system actors) are shown as they are.
    const other = await createOrder(adminActor, input());
    expect((await getOrder(adminActor, other.id)).createdByName).toBe(adminActor.id);

    const reason = await createSetupRecord(adminActor, "delivery-reasons", { businessUnitId, name: "Vehicle Not Available" });
    await prisma.salesOrder.update({ where: { id: approved.id }, data: { deliveryPendingReasonId: reason.id } });
    const byReason = await listOrders(adminActor, { pendingReasonId: reason.id });
    expect(byReason.rows.map((row) => row.id)).toEqual([approved.id]);
    expect(byReason.rows[0].pendingReasonName).toBe("Vehicle Not Available");
    expect((await getOrder(adminActor, approved.id)).pendingReasonName).toBe("Vehicle Not Available");

    const list = await listOrders(adminActor, { createdBy: user.id });
    expect(list.rows.map((row) => row.id)).toEqual([approved.id]);
    expect(list.creators).toEqual(expect.arrayContaining([{ id: user.id, name: "Md. Manik Miah" }, { id: adminActor.id, name: adminActor.id }]));

    const fresh = await getOrder(adminActor, approved.id);
    const closed = await act(adminActor, approved.id, fresh.updatedAt, "complete", "Customer stopped the order.");
    expect(closed).toMatchObject({ status: "COMPLETED", closedRemarks: "Customer stopped the order." });
  });
});
