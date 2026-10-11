import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createCustomer, createItem, createSalesPerson, getSalesLookups } from "@/features/sales/masters/services/masters.service";
import { quotationTotals } from "@/features/sales/quotations/lib/totals";
import { displayStatus, quotationInputSchema, type QuotationInput } from "@/features/sales/quotations/schemas/quotation.schema";
import {
  changeQuotationStatus,
  createQuotation,
  deleteQuotation,
  getQuotation,
  listQuotations,
  updateQuotation,
} from "@/features/sales/quotations/services/quotation.service";
import { adminActor, businessUnitInput, companyInput, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";

describe("quotationTotals", () => {
  it("applies line discounts, then the header discount, then VAT", () => {
    const totals = quotationTotals(
      [
        { qty: 10, rate: 100, discountPercent: 10 },
        { qty: 2.5, rate: 40, discountPercent: 0 },
      ],
      100,
      15,
    );
    expect(totals).toEqual({
      lineAmounts: [900, 100],
      totalQty: 12.5,
      subTotal: 1000,
      discountAmount: 100,
      vatAmount: 135,
      grandTotal: 1035,
    });
  });

  it("caps the discount at the subtotal and rounds to paisa", () => {
    expect(quotationTotals([{ qty: 3, rate: 33.333, discountPercent: 0 }], 500, 0)).toMatchObject({
      subTotal: 100,
      discountAmount: 100,
      grandTotal: 0,
    });
  });
});

describe("displayStatus", () => {
  it("shows submitted quotations past their validity as expired", () => {
    expect(displayStatus("SUBMITTED", "2026-10-10", "2026-10-11")).toBe("EXPIRED");
    expect(displayStatus("SUBMITTED", "2026-10-11", "2026-10-11")).toBe("SUBMITTED");
    expect(displayStatus("DRAFT", "2026-10-01", "2026-10-11")).toBe("DRAFT");
  });
});

describe("quotationInputSchema", () => {
  const base = {
    officeId: crypto.randomUUID(),
    customerId: crypto.randomUUID(),
    quotationDate: "2026-10-11",
    validTill: "2026-10-25",
    discountAmount: 0,
    vatPercent: 0,
    lines: [{ itemId: crypto.randomUUID(), qty: 1, rate: 100, discountPercent: 0 }],
  };

  it("accepts a valid quotation", () => {
    expect(quotationInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects bad dates, empty lines, zero qty and over-discount", () => {
    const issues = (input: object) =>
      quotationInputSchema.safeParse({ ...base, ...input }).error?.issues.map((issue) => issue.message);
    expect(issues({ validTill: "2026-10-01" })).toEqual(["Valid till date cannot be before the quotation date."]);
    expect(issues({ lines: [] })).toEqual(["Add at least one item."]);
    expect(issues({ lines: [{ ...base.lines[0], qty: 0 }] })).toEqual(["Qty must be more than 0."]);
    expect(issues({ discountAmount: 101 })).toEqual(["Discount cannot be more than the subtotal."]);
  });
});

describe("sales quotations", () => {
  let prisma: PrismaClient;
  let companyId: string;
  let businessUnitId: string;
  let officeId: string;
  let otherUnitOfficeId: string;
  let customerId: string;
  let salesPersonId: string;
  let itemId: string;
  let secondItemId: string;

  const input = (overrides: Partial<QuotationInput> = {}): QuotationInput => ({
    officeId,
    customerId,
    salesPersonId,
    quotationDate: "2026-10-11",
    validTill: "2026-10-25",
    contactMobile: "01700000000",
    remarks: null,
    terms: "1. Prices include delivery.",
    discountAmount: 50,
    vatPercent: 5,
    lines: [
      { itemId, qty: 10, rate: 100, discountPercent: 0 },
      { itemId: secondItemId, qty: 4, rate: 25, discountPercent: 10, description: "Family pack" },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const company = await prisma.company.create({ data: companyInput });
    companyId = company.id;
    const unit = await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } });
    businessUnitId = unit.id;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    const otherUnit = await prisma.businessUnit.create({ data: { ...businessUnitInput, name: "Other Unit", companyId } });
    otherUnitOfficeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId: otherUnit.id } })).id;

    salesPersonId = (await createSalesPerson(adminActor, { businessUnitId, name: "Md. Anarul Islam", designation: "RSM" })).id;
    customerId = (
      await createCustomer(adminActor, { businessUnitId, name: "Vai Vai Traders", phone: "01711111111", creditDays: 15 })
    ).id;
    itemId = (await createItem(adminActor, { businessUnitId, name: "Bar-B-Q Biriyani", uom: "Pcs", salesRate: 100 })).id;
    secondItemId = (await createItem(adminActor, { businessUnitId, name: "Dal Vaja 10gm", uom: "Pkt", salesRate: 25 })).id;
  });

  afterAll(stopTestDb);

  describe("masters", () => {
    it("generates codes in sequence and rejects duplicate codes", async () => {
      const second = await createCustomer(adminActor, { businessUnitId, name: "Sobuj Poultry", creditDays: 0 });
      expect(second.code).toBe("CUST-00002");
      await expect(
        createCustomer(adminActor, { businessUnitId, code: "CUST-00002", name: "Copy", creditDays: 0 }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("lists offices and default quotation terms in scope", async () => {
      await prisma.termsCondition.create({
        data: {
          businessUnitId,
          domain: "SALES",
          content: "Payment within 15 days.",
          isDefault: true,
          sortOrder: 1,
          applicability: { create: [{ documentType: "SALES_QUOTATION" }] },
        },
      });
      const lookups = await getSalesLookups(adminActor);
      expect(lookups.offices).toHaveLength(2);
      expect(lookups.quotationTerms[businessUnitId]).toBe("1. Payment within 15 days.");
      expect((await getSalesLookups(scopedActor([OTHER_COMPANY]))).offices).toEqual([]);
    });
  });

  it("creates a draft with server-computed totals and a yearly number", async () => {
    const quotation = await createQuotation(adminActor, input());
    expect(quotation).toMatchObject({
      number: "SQ-2026-00001",
      status: "DRAFT",
      customerName: "Vai Vai Traders",
      totalQty: 14,
      subTotal: 1090,
      discountAmount: 50,
      vatAmount: 52,
      grandTotal: 1092,
      createdBy: adminActor.id,
    });
    expect(quotation.lines.map((line) => [line.lineNo, line.itemName, line.uom, line.amount])).toEqual([
      [1, "Bar-B-Q Biriyani", "Pcs", 1000],
      [2, "Dal Vaja 10gm", "Pkt", 90],
    ]);

    const next = await createQuotation(adminActor, input());
    expect(next.number).toBe("SQ-2026-00002");
    const nextYear = await createQuotation(adminActor, input({ quotationDate: "2027-01-02", validTill: "2027-01-10" }));
    expect(nextYear.number).toBe("SQ-2027-00001");
  });

  it("issues distinct numbers to concurrent creates", async () => {
    const created = await Promise.all([1, 2, 3, 4].map(() => createQuotation(adminActor, input())));
    expect(new Set(created.map((quotation) => quotation.number)).size).toBe(4);
  });

  it("rejects customers and items from another business unit, and offices outside the scope", async () => {
    await expect(createQuotation(adminActor, input({ officeId: otherUnitOfficeId }))).rejects.toMatchObject({
      status: 400,
    });
    await expect(createQuotation(scopedActor([OTHER_COMPANY]), input())).rejects.toMatchObject({ status: 404 });
  });

  it("edits drafts only, with optimistic locking", async () => {
    const draft = await createQuotation(adminActor, input());
    const edited = await updateQuotation(adminActor, draft.id, {
      version: draft.updatedAt,
      data: input({ discountAmount: 0, vatPercent: 0, lines: [{ itemId, qty: 2, rate: 120, discountPercent: 0 }] }),
    });
    expect(edited.grandTotal).toBe(240);
    expect(edited.lines).toHaveLength(1);

    // Stale version: someone saved in between.
    await expect(
      updateQuotation(adminActor, draft.id, { version: draft.updatedAt, data: input() }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Someone else") });

    const submitted = await changeQuotationStatus(adminActor, draft.id, { action: "submit", version: edited.updatedAt });
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submittedAt).not.toBeNull();
    await expect(
      updateQuotation(adminActor, draft.id, { version: submitted.updatedAt, data: input() }),
    ).rejects.toMatchObject({ status: 409, message: "A submitted quotation cannot be edited." });
    await expect(deleteQuotation(adminActor, draft.id)).rejects.toMatchObject({ status: 409 });
  });

  it("moves through submit → lost → reopen → cancel", async () => {
    let quotation = await createQuotation(adminActor, input());
    const step = async (action: "submit" | "cancel" | "lost" | "reopen", reason?: string) =>
      (quotation = await changeQuotationStatus(adminActor, quotation.id, { action, version: quotation.updatedAt, reason }));

    await expect(step("cancel")).rejects.toMatchObject({ status: 409 });
    await step("submit");
    await expect(step("lost")).rejects.toMatchObject({ status: 400 });
    await step("lost", "Price too high");
    expect(quotation).toMatchObject({ status: "LOST", lostReason: "Price too high" });
    await step("reopen");
    expect(quotation).toMatchObject({ status: "SUBMITTED", lostReason: null });
    await step("cancel");
    expect(quotation.status).toBe("CANCELLED");
    expect(quotation.cancelledAt).not.toBeNull();
  });

  it("deletes drafts", async () => {
    const draft = await createQuotation(adminActor, input());
    await deleteQuotation(adminActor, draft.id);
    await expect(getQuotation(adminActor, draft.id)).rejects.toMatchObject({ status: 404 });
  });

  it("filters the list by office, dates and status (expired derived from today)", async () => {
    const early = await createQuotation(adminActor, input({ quotationDate: "2026-10-01", validTill: "2026-10-05" }));
    await changeQuotationStatus(adminActor, early.id, { action: "submit", version: early.updatedAt });
    const current = await createQuotation(adminActor, input());
    await changeQuotationStatus(adminActor, current.id, { action: "submit", version: current.updatedAt });
    await createQuotation(adminActor, input());

    const today = "2026-10-11";
    const numbers = async (query: object) =>
      (await listQuotations(adminActor, { today, ...query })).map((row) => row.number);

    expect(await numbers({})).toEqual(["SQ-2026-00003", "SQ-2026-00002", "SQ-2026-00001"]);
    expect(await numbers({ status: "EXPIRED" })).toEqual(["SQ-2026-00001"]);
    expect(await numbers({ status: "SUBMITTED" })).toEqual(["SQ-2026-00002"]);
    expect(await numbers({ status: "DRAFT" })).toEqual(["SQ-2026-00003"]);
    expect(await numbers({ from: "2026-10-02", to: "2026-10-31" })).toEqual(["SQ-2026-00003", "SQ-2026-00002"]);
    expect(await numbers({ officeId: otherUnitOfficeId })).toEqual([]);
    expect(await listQuotations(scopedActor([OTHER_COMPANY]), { today })).toEqual([]);

    const [row] = await listQuotations(scopedActor([companyId]), { today, status: "DRAFT" });
    expect(row).toMatchObject({ officeName: "Head Office", customerName: "Vai Vai Traders", contactMobile: "01700000000" });
  });
});
