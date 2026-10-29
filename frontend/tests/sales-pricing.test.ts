import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDueCollection, collectionWallets } from "@/features/sales/collections/services/collection.service";
import { createCustomer, createItem, createSetupRecord, getSetupLookups } from "@/features/sales/masters/services/masters.service";
import type { OrderInput } from "@/features/sales/orders/schemas/order.schema";
import { createOrder, getOrder, listOrders, updateOrder } from "@/features/sales/orders/services/order.service";
import { computeOffers, type OfferRule } from "@/features/sales/pricing/lib/offers";
import { returnRateFor } from "@/features/sales/pricing/schemas/pricing.schema";
import { previewPricing, returnRates, tierOf } from "@/features/sales/pricing/services/pricing.service";
import { createQuotation } from "@/features/sales/quotations/services/quotation.service";
import { adminActor, businessUnitInput, companyInput, officeInput } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const TODAY = "2026-10-11";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("computeOffers", () => {
  const lines = [
    { itemId: "noodles", qty: 50, unitPrice: 10, discountPercent: 0 },
    { itemId: "muri", qty: 20, unitPrice: 40, discountPercent: 5 },
  ];

  it("gives free items per whole multiple and for a full item set", () => {
    const rules: OfferRule[] = [
      { kind: "ITEM", name: "Buy 24 get 2", lines: [{ sellingItemId: "noodles", sellingQty: 24, offerItemId: "noodles", offerQty: 2 }] },
      {
        kind: "ITEM_MULTIPLE",
        name: "Combo",
        pairs: [
          { itemId: "noodles", quantity: 10, minQty: null, maxQty: null },
          { itemId: "muri", quantity: 10, minQty: null, maxQty: null },
        ],
        bonus: [{ itemId: "bag", quantity: 1 }],
      },
    ];
    const result = computeOffers(rules, lines);
    expect(result.free).toEqual([
      { itemId: "noodles", qty: 4, offerName: "Buy 24 get 2" },
      { itemId: "bag", qty: 2, offerName: "Combo" },
    ]);
    expect(result.freeItemIds.sort()).toEqual(["bag", "noodles"]);
  });

  it("takes the best line discount and an invoice discount on the discounted total", () => {
    const rules: OfferRule[] = [
      { kind: "DISCOUNT", name: "Noodles 5%", lines: [{ itemId: "noodles", discountType: "PERCENT", amount: 5, quantity: null, minQty: 10, maxQty: null, isRecurrent: false }] },
      { kind: "DISCOUNT", name: "Tk 1 off", lines: [{ itemId: "noodles", discountType: "FLAT", amount: 1, quantity: null, minQty: null, maxQty: null, isRecurrent: false }] },
      { kind: "DISCOUNT", name: "Too small", lines: [{ itemId: "muri", discountType: "PERCENT", amount: 20, quantity: null, minQty: 100, maxQty: null, isRecurrent: false }] },
      { kind: "SPECIAL_DISCOUNT", name: "Big invoice", lines: [{ discountType: "PERCENT", amount: 2, fromAmount: 1000, toAmount: null }] },
    ];
    const result = computeOffers(rules, lines);
    // Tk 1 on Tk 10 = 10% beats 5%; muri is below its minimum.
    expect(result.discounts).toEqual([{ itemId: "noodles", percent: 10, offerName: "Tk 1 off" }]);
    // 50 × 10 × 0.9 + 20 × 40 × 0.95 = 450 + 760 = 1,210 → 2% = 24.2
    expect(result).toMatchObject({ invoiceDiscount: 24.2, invoiceOfferName: "Big invoice" });
  });

  it("gives a flat amount per recurring quantity", () => {
    const rules: OfferRule[] = [
      { kind: "DISCOUNT", name: "Tk 24 per carton", lines: [{ itemId: "noodles", discountType: "FLAT", amount: 24, quantity: 24, minQty: null, maxQty: null, isRecurrent: true }] },
    ];
    // 2 cartons → Tk 48 on Tk 500 = 9.6%
    expect(computeOffers(rules, lines).discounts).toEqual([{ itemId: "noodles", percent: 9.6, offerName: "Tk 24 per carton" }]);
  });
});

describe("tierOf", () => {
  it("uses the dealer price for dealer price types", () => {
    expect(tierOf("Dealer Price")).toBe("DP");
    expect(tierOf("DP")).toBe("DP");
    expect(tierOf("Trade Price")).toBe("TP");
    expect(tierOf(null)).toBe("TP");
  });
});

describe("sales pricing from Sales Config", () => {
  let prisma: PrismaClient;
  let businessUnitId: string;
  let officeId: string;
  let customerId: string;
  let groupId: string;
  let dealerListId: string;
  let noodlesId: string;
  let muriId: string;
  let bagId: string;

  const orderInput = (overrides: Partial<OrderInput> = {}): OrderInput => ({
    officeId,
    customerId,
    salesPersonId: null,
    priceListId: dealerListId,
    shipToAddressId: null,
    orderType: "SALES",
    paymentMethod: "CREDIT",
    orderDate: TODAY,
    expectedDeliveryDate: TODAY,
    priceIncludesVat: false,
    isForeign: false,
    paymentTermDays: 0,
    dueLimit: 0,
    discountAmount: 0,
    deliveryCharge: 0,
    unloadingCharge: 0,
    lines: [
      { itemId: noodlesId, qty: 48, unitPrice: 14, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
      { itemId: muriId, qty: 10, unitPrice: 45, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    const bu = { businessUnitId };
    groupId = (await createSetupRecord(adminActor, "customer-groups", { ...bu, name: "Tangail Region" })).id;
    dealerListId = (await createSetupRecord(adminActor, "price-lists", { ...bu, name: "Dealer Price", isDefault: true })).id;
    customerId = (await createCustomer(adminActor, { ...bu, name: "M/S Sadia Enterprise", customerGroupId: groupId, creditDays: 0, creditLimit: null, addresses: [] })).id;
    noodlesId = (await createItem(adminActor, { ...bu, name: "Marine Noodles 120 gm", uom: "PCS", salesRate: 15, prices: [{ priceListId: dealerListId, rate: 14.6 }] })).id;
    muriId = (await createItem(adminActor, { ...bu, name: "Marine Muri 400g", uom: "PCS", salesRate: 46.7 })).id;
    bagId = (await createItem(adminActor, { ...bu, name: "Marine Shopping Bag", uom: "PCS", salesRate: 5 })).id;
  });

  afterAll(stopTestDb);

  const preview = (lines: { itemId: string; qty: number; unitPrice?: number }[], priceListId: string | null = dealerListId) =>
    previewPricing(adminActor, { officeId, customerId, priceListId, date: TODAY, lines });
  const rateOf = async (itemId: string, qty = 1, priceListId: string | null = dealerListId) =>
    (await preview([{ itemId, qty }], priceListId)).prices.find((price) => price.itemId === itemId);

  it("resolves the rate: customer > customer group > standard > price type > sales rate", async () => {
    expect(await rateOf(noodlesId)).toMatchObject({ rate: 14.6, source: "PRICE_TYPE", tier: "DP" });
    expect(await rateOf(muriId)).toMatchObject({ rate: 46.7, source: "ITEM" });

    await prisma.standardPrice.createMany({
      data: [
        { businessUnitId, itemId: noodlesId, effectiveFrom: day("2026-10-01"), dealerPrice: 13.5, tradingPrice: 14.2, minSalesPrice: 12, mrp: 16 },
        // Not effective yet.
        { businessUnitId, itemId: noodlesId, effectiveFrom: day("2026-11-01"), dealerPrice: 99, tradingPrice: 99 },
      ],
    });
    expect(await rateOf(noodlesId)).toMatchObject({ rate: 13.5, source: "STANDARD", minSalesPrice: 12, mrp: 16 });
    // No price type (and none on the customer) → trading price.
    expect(await rateOf(noodlesId, 1, null)).toMatchObject({ rate: 14.2, source: "STANDARD", tier: "TP" });

    await prisma.customerGroupPriceSetup.create({
      data: {
        businessUnitId,
        officeId,
        customerGroupId: groupId,
        createDate: day("2026-10-01"),
        lines: { create: [{ sortOrder: 1, itemId: noodlesId, fromQty: 100, toQty: null, dpPrice: 13, tpPrice: 13.8 }] },
      },
    });
    expect(await rateOf(noodlesId, 50)).toMatchObject({ rate: 13.5, source: "STANDARD" });
    expect(await rateOf(noodlesId, 100)).toMatchObject({ rate: 13, source: "CUSTOMER_GROUP" });

    await prisma.customerPriceSetup.create({
      data: { businessUnitId, customerId, lines: { create: [{ sortOrder: 1, itemId: noodlesId, dpPrice: 12.5, tpPrice: 13.2 }] } },
    });
    expect(await rateOf(noodlesId, 100)).toMatchObject({ rate: 12.5, source: "CUSTOMER" });
  });

  it("refuses a price below the Standard Price minimum", async () => {
    await prisma.standardPrice.create({ data: { businessUnitId, itemId: noodlesId, effectiveFrom: day("2026-10-01"), dealerPrice: 13.5, minSalesPrice: 14.5 } });
    await expect(createOrder(adminActor, orderInput())).rejects.toThrow("below the minimum sales price 14.5");
    await expect(
      createQuotation(adminActor, {
        officeId,
        customerId,
        quotationDate: TODAY,
        validTill: TODAY,
        lines: [{ itemId: noodlesId, qty: 10, rate: 14 }],
      }),
    ).rejects.toThrow("below the minimum sales price");
    const ok = await createOrder(adminActor, orderInput({ lines: [{ itemId: noodlesId, qty: 48, unitPrice: 14.5, discountPercent: 0, vatPercent: 0, aitPercent: 0 }] }));
    expect(ok.lines).toHaveLength(1);
  });

  it("applies offers on save and replaces earlier free lines on edit", async () => {
    await prisma.salesOffer.create({
      data: {
        businessUnitId,
        kind: "ITEM",
        name: "Buy 24 Noodles get 1 Bag",
        customerGroupId: groupId,
        itemLines: { create: [{ sortOrder: 1, sellingItemId: noodlesId, sellingUom: "PCS", sellingQty: 24, offerItemId: bagId, offerUom: "PCS", offerQty: 1 }] },
      },
    });
    await prisma.salesOffer.create({
      data: {
        businessUnitId,
        kind: "DISCOUNT",
        name: "Muri 10%",
        basedOn: "All Customers",
        discountLines: { create: [{ sortOrder: 1, itemId: muriId, discountType: "PERCENT", amount: 10 }] },
      },
    });
    await prisma.salesOffer.create({
      data: {
        businessUnitId,
        kind: "SPECIAL_DISCOUNT",
        name: "Invoice over 1000",
        basedOn: "Invoice Amount",
        specialLines: { create: [{ sortOrder: 1, discountType: "FLAT", amount: 50, fromAmount: 1000 }] },
      },
    });
    // Out of date and for another price type: ignored.
    await prisma.salesOffer.create({
      data: { businessUnitId, kind: "DISCOUNT", name: "Expired", toDate: day("2026-09-30"), discountLines: { create: [{ sortOrder: 1, itemId: noodlesId, discountType: "PERCENT", amount: 50 }] } },
    });

    const shown = await preview([
      { itemId: noodlesId, qty: 48, unitPrice: 14 },
      { itemId: muriId, qty: 10, unitPrice: 45 },
    ]);
    expect(shown.offers).toMatchObject({
      freeLines: [{ itemId: bagId, qty: 2, rate: 5, offerName: "Buy 24 Noodles get 1 Bag" }],
      discounts: [{ itemId: muriId, percent: 10, offerName: "Muri 10%" }],
      invoiceDiscount: 50,
    });

    const order = await createOrder(adminActor, orderInput());
    expect(order.lines.map((line) => [line.itemName, line.qty, line.unitPrice, line.discountPercent])).toEqual([
      ["Marine Noodles 120 gm", 48, 14, 0],
      ["Marine Muri 400g", 10, 45, 10],
      ["Marine Shopping Bag", 2, 5, 100],
    ]);
    // 672 + 405 + 0 = 1,077 − 50
    expect(order).toMatchObject({ itemsTotal: 1077, discountAmount: 50, salesTotal: 1027 });

    // Editing sends the free line back: it is replaced, not doubled.
    const again = await updateOrder(adminActor, order.id, {
      version: order.updatedAt,
      data: orderInput({
        lines: [
          ...orderInput().lines.map((line) => (line.itemId === muriId ? { ...line, discountPercent: 10 } : line)),
          { itemId: bagId, qty: 2, unitPrice: 5, discountPercent: 100, vatPercent: 0, aitPercent: 0 },
        ].map((line) => (line.itemId === noodlesId ? { ...line, qty: 24 } : line)),
      }),
    });
    expect(again.lines.map((line) => [line.itemName, line.qty])).toEqual([
      ["Marine Noodles 120 gm", 24],
      ["Marine Muri 400g", 10],
      ["Marine Shopping Bag", 1],
    ]);
    expect((await getOrder(adminActor, order.id)).discountAmount).toBe(0);

    const quotation = await createQuotation(adminActor, {
      officeId,
      customerId,
      quotationDate: TODAY,
      validTill: TODAY,
      lines: [{ itemId: noodlesId, qty: 24, rate: 14 }],
    });
    expect(quotation.lines.map((line) => [line.itemName, line.qty, line.discountPercent, line.amount])).toEqual([
      ["Marine Noodles 120 gm", 24, 0, 336],
      ["Marine Shopping Bag", 1, 100, 0],
    ]);
  });

  it("returns the Return Price Setup rates effective on the return date", async () => {
    await prisma.salesReturnPrice.createMany({
      data: [
        { businessUnitId, itemId: noodlesId, effectiveFrom: day("2026-09-01"), damageRate: 7, expireRate: 5, damageExpireRate: 4, soundStockRate: 13 },
        { businessUnitId, itemId: noodlesId, effectiveFrom: day("2026-10-05"), damageRate: 7.5, expireRate: 5.5, damageExpireRate: 4.5, soundStockRate: 13.5 },
      ],
    });
    const [rates] = await returnRates(adminActor, { officeId, date: TODAY, itemIds: [noodlesId, muriId] });
    expect(rates).toEqual({ itemId: noodlesId, damageRate: 7.5, expireRate: 5.5, damageExpireRate: 4.5, soundStockRate: 13.5 });
    expect(["Damaged", "Packet Torn", "Expired", "Short Expiry", "Good Product Return"].map((reason) => returnRateFor(rates, reason))).toEqual([7.5, 7.5, 5.5, 5.5, 13.5]);
    expect((await returnRates(adminActor, { officeId, date: "2026-09-15", itemIds: [noodlesId] }))[0].damageRate).toBe(7);
  });

  it("offers Wallet Setup wallets on due collection and enforces their reference", async () => {
    const bankAccountId = (await prisma.bankAccount.create({ data: { accountNumber: "0011223344", bankName: "Test Bank", branchName: "Main", accountHolder: "Test Co" } })).id;
    const bkash = await prisma.salesWallet.create({ data: { businessUnitId, name: "bKash", commissionPercent: 1.85, isMfs: true, isReferenceRequired: true, bankAccountId } });
    await prisma.salesWallet.create({ data: { businessUnitId, name: "Old Wallet", commissionPercent: 0, isActive: false } });
    expect(await collectionWallets(adminActor, officeId)).toEqual([
      { id: bkash.id, name: "bKash", commissionPercent: 1.85, isCash: false, isMfs: true, isReferenceRequired: true, glAccountId: null },
    ]);
    await expect(
      createDueCollection(adminActor, {
        officeId,
        collectionDate: TODAY,
        method: "MOBILE_BANKING",
        walletId: bkash.id,
        rows: [{ customerId, allocations: [{ deliveryId: crypto.randomUUID(), amount: 100 }] }],
      }),
    ).rejects.toThrow("Enter the transaction / reference no for bKash.");
  });

  it("filters lists by a Sales Setup region: every territory below it", async () => {
    const territoryId = (await createSetupRecord(adminActor, "areas", { businessUnitId, kind: "TERRITORY", name: "Mogbazar" })).id;
    await prisma.customer.update({ where: { id: customerId }, data: { territoryId } });
    const regionLayer = await prisma.salesTerritoryLayer.create({ data: { businessUnitId, level: 1, code: "REG", name: "Region" } });
    const territoryLayer = await prisma.salesTerritoryLayer.create({ data: { businessUnitId, level: 2, code: "TER", name: "Territory", isTerritory: true } });
    const dhaka = await prisma.salesTerritoryNode.create({ data: { businessUnitId, layerId: regionLayer.id, code: "R1", name: "Dhaka" } });
    const khulna = await prisma.salesTerritoryNode.create({ data: { businessUnitId, layerId: regionLayer.id, code: "R2", name: "Khulna" } });
    await prisma.salesTerritoryNode.create({ data: { businessUnitId, layerId: territoryLayer.id, parentId: dhaka.id, code: "T1", name: "Mogbazar", salesAreaId: territoryId } });
    await createOrder(adminActor, orderInput());

    expect((await listOrders(adminActor, { territoryId })).totalCount).toBe(1);
    expect((await listOrders(adminActor, { territoryId: dhaka.id })).totalCount).toBe(1);
    expect((await listOrders(adminActor, { territoryId: khulna.id })).totalCount).toBe(0);
    expect((await getSetupLookups(adminActor, businessUnitId)).territoryGroups.map((node) => [node.layer, node.name])).toEqual([
      ["Region", "Dhaka"],
      ["Region", "Khulna"],
    ]);
  });
});
