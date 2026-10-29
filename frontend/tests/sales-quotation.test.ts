import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { richTextToPlain } from "@/lib/rich-text";
import { createCustomer, createItem, createSalesPerson, getSalesLookups } from "@/features/sales/masters/services/masters.service";
import { lineFigures, quotationTotals } from "@/features/sales/quotations/lib/totals";
import { displayStatus, quotationInputSchema, type QuotationInput } from "@/features/sales/quotations/schemas/quotation.schema";
import { quotationPdf, quotationsExcel } from "@/features/sales/quotations/services/quotation-export";
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

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const clerk: Actor = { ...adminActor, id: "clerk", isMaster: false, permissions: new Set(["sales:read", "sales:write"]) };

const doc = (...paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

describe("quotation totals", () => {
  it("applies the line discount, then adds VAT and AIT on the net", () => {
    // Base 1,000; disc 10% = 100; net 900; VAT 15% = 135; AIT 2% = 18 → 1,053
    expect(lineFigures({ qty: 10, rate: 100, discountPercent: 10, vatPercent: 15, aitPercent: 2 }, false)).toEqual({
      base: 1000,
      discountAmount: 100,
      vatAmount: 135,
      aitAmount: 18,
      amount: 1053,
    });
  });

  it("takes VAT out of VAT-inclusive prices instead of adding it", () => {
    // 1,150 includes 15% VAT: taxable = 1,150 ÷ 1.15 = 1,000, VAT 150; AIT 1% of the taxable = 10; total = 1,160
    expect(lineFigures({ qty: 10, rate: 115, discountPercent: 0, vatPercent: 15, aitPercent: 1 }, true)).toEqual({
      base: 1150,
      discountAmount: 0,
      vatAmount: 150,
      aitAmount: 10,
      amount: 1160,
    });
  });

  it("sums the lines", () => {
    const totals = quotationTotals(
      [
        { qty: 10, rate: 100, discountPercent: 10, vatPercent: 15, aitPercent: 2 },
        { qty: 2.5, rate: 40, discountPercent: 0, vatPercent: 0, aitPercent: 0 },
      ],
      false,
    );
    expect(totals).toMatchObject({ totalQty: 12.5, subTotal: 1100, discountAmount: 100, vatAmount: 135, aitAmount: 18, grandTotal: 1153 });
  });
});

describe("displayStatus and the rich text", () => {
  it("shows approved quotations past their validity as expired", () => {
    expect(displayStatus("SUBMITTED", "2026-10-10", "2026-10-11")).toBe("EXPIRED");
    expect(displayStatus("SUBMITTED", "2026-10-11", "2026-10-11")).toBe("SUBMITTED");
    expect(displayStatus("DRAFT", "2026-10-01", "2026-10-11")).toBe("DRAFT");
  });

  it("turns an editor document into plain text", () => {
    expect(
      richTextToPlain({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Dear Sir," }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh stock" }] }] }] },
        ],
      }),
    ).toBe("Dear Sir,\n• Fresh stock");
  });
});

describe("quotationInputSchema", () => {
  const base = {
    officeId: crypto.randomUUID(),
    customerId: crypto.randomUUID(),
    quotationDate: "2026-10-11",
    validTill: "2026-10-25",
    lines: [{ itemId: crypto.randomUUID(), qty: 1, rate: 100 }],
  };

  it("accepts a valid quotation", () => {
    expect(quotationInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects bad dates, empty lines, zero qty or price, bad rich text and empty terms", () => {
    const issues = (input: object) => quotationInputSchema.safeParse({ ...base, ...input }).error?.issues.map((issue) => issue.message);
    expect(issues({ validTill: "2026-10-01" })).toEqual(["Valid Till Date cannot be before the Create Date."]);
    expect(issues({ lines: [] })).toEqual(["At least one item is required in the quotation."]);
    expect(issues({ lines: [{ ...base.lines[0], qty: 0 }] })).toEqual(["Qty must be more than 0."]);
    expect(issues({ lines: [{ ...base.lines[0], rate: 0 }] })).toEqual(["Unit Price must be more than 0."]);
    expect(issues({ lines: [{ ...base.lines[0], deliveryDate: "2026-10-01" }] })).toEqual(["A delivery date cannot be before the Create Date."]);
    expect(issues({ remarksBody: { type: "html", content: [] } })).toHaveLength(1);
    expect(issues({ remarksBody: doc("x".repeat(120_000)) })).toEqual(["The text is too long."]);
    expect(issues({ terms: [{ text: " " }] })).toEqual(["Write the term or remove it."]);
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
    billingAddress: "Gaibandha Sadar",
    billingContactPerson: "Md. Karim",
    billingContactNo: "01800000000",
    reference: "Visit 12-10",
    subject: "Price offer for snacks",
    quotationType: "Quotation",
    includingVat: false,
    remarksBody: doc("Dear Sir,", "Please find our offer below.") as QuotationInput["remarksBody"],
    remarksFooter: doc("Thank you.") as QuotationInput["remarksFooter"],
    terms: [
      { text: "Prices include delivery.", optional: false },
      { text: "Advance 50%.", optional: true },
    ],
    lines: [
      { itemId, qty: 10, rate: 100, discountPercent: 10, vatPercent: 15, aitPercent: 2, warranty: "12 Month", deliveryDate: "2026-10-20" },
      { itemId: secondItemId, qty: 4, rate: 25, description: "Family pack" },
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
    customerId = (await createCustomer(adminActor, { businessUnitId, name: "Vai Vai Traders", phone: "01711111111", creditDays: 15 })).id;
    itemId = (await createItem(adminActor, { businessUnitId, name: "Bar-B-Q Biriyani", uom: "Pcs", salesRate: 100 })).id;
    secondItemId = (await createItem(adminActor, { businessUnitId, name: "Dal Vaja 10gm", uom: "Pkt", salesRate: 25 })).id;
  });

  afterAll(stopTestDb);

  it("lists offices and default quotation terms in scope", async () => {
    await prisma.termsCondition.create({
      data: { businessUnitId, domain: "SALES", content: "Payment within 15 days.", isDefault: true, sortOrder: 1, applicability: { create: [{ documentType: "SALES_QUOTATION" }] } },
    });
    const lookups = await getSalesLookups(adminActor);
    expect(lookups.offices).toHaveLength(2);
    expect(lookups.quotationTerms[businessUnitId]).toBe("1. Payment within 15 days.");
    expect((await getSalesLookups(scopedActor([OTHER_COMPANY]))).offices).toEqual([]);
  });

  it("creates a pending quotation with per-line VAT / AIT, rich text, terms and an SQ-MG number", async () => {
    const quotation = await createQuotation(adminActor, input());
    // Line 1: 1,000 − 100 + 135 + 18 = 1,053; line 2: 100
    expect(quotation).toMatchObject({
      number: "SQ-MG260000001",
      status: "DRAFT",
      customerName: "Vai Vai Traders",
      billingAddress: "Gaibandha Sadar",
      subject: "Price offer for snacks",
      totalQty: 14,
      subTotal: 1100,
      discountAmount: 100,
      vatAmount: 135,
      aitAmount: 18,
      grandTotal: 1153,
      remarks: "Dear Sir,\nPlease find our offer below.",
      terms: "1. Prices include delivery.\n2. Advance 50%. (optional)",
      createdBy: adminActor.id,
    });
    expect(quotation.termsList).toEqual([
      { text: "Prices include delivery.", optional: false },
      { text: "Advance 50%.", optional: true },
    ]);
    expect(quotation.lines.map((line) => [line.lineNo, line.itemName, line.uom, line.vatAmount, line.aitAmount, line.amount, line.warranty, line.deliveryDate])).toEqual([
      [1, "Bar-B-Q Biriyani", "Pcs", 135, 18, 1053, "12 Month", "2026-10-20"],
      [2, "Dal Vaja 10gm", "Pkt", 0, 0, 100, null, null],
    ]);

    expect((await createQuotation(adminActor, input())).number).toBe("SQ-MG260000002");
    expect((await createQuotation(adminActor, input({ quotationDate: "2027-01-02", validTill: "2027-01-10", lines: [{ itemId, qty: 1, rate: 10 }] }))).number).toBe("SQ-MG270000001");

    const inclusive = await createQuotation(adminActor, input({ includingVat: true, lines: [{ itemId, qty: 10, rate: 115, vatPercent: 15 }] }));
    expect(inclusive).toMatchObject({ vatAmount: 150, grandTotal: 1150 });
  });

  it("issues distinct numbers to concurrent creates", async () => {
    const created = await Promise.all([1, 2, 3, 4].map(() => createQuotation(adminActor, input())));
    expect(new Set(created.map((quotation) => quotation.number)).size).toBe(4);
  });

  it("rejects customers and items from another business unit, and offices outside the scope", async () => {
    await expect(createQuotation(adminActor, input({ officeId: otherUnitOfficeId }))).rejects.toMatchObject({ status: 400 });
    await expect(createQuotation(scopedActor([OTHER_COMPANY]), input())).rejects.toMatchObject({ status: 404 });
  });

  it("edits pending quotations only, with optimistic locking", async () => {
    const draft = await createQuotation(adminActor, input());
    const edited = await updateQuotation(adminActor, draft.id, {
      version: draft.updatedAt,
      data: input({ remarksBody: null, terms: [], lines: [{ itemId, qty: 2, rate: 120 }] }),
    });
    expect(edited).toMatchObject({ grandTotal: 240, remarksBody: null, termsList: [] });
    expect(edited.lines).toHaveLength(1);

    await expect(updateQuotation(adminActor, draft.id, { version: draft.updatedAt, data: input() })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Someone else"),
    });

    const approved = await changeQuotationStatus(adminActor, draft.id, { action: "approve", version: edited.updatedAt });
    expect(approved).toMatchObject({ status: "SUBMITTED", approvedBy: adminActor.id });
    await expect(updateQuotation(adminActor, draft.id, { version: approved.updatedAt, data: input() })).rejects.toMatchObject({
      status: 409,
      message: "This quotation is approved and cannot be edited.",
    });
    await expect(deleteQuotation(adminActor, draft.id)).rejects.toMatchObject({ status: 409 });
  });

  it("approves or rejects with the approve permission, then reopens and cancels", async () => {
    let quotation = await createQuotation(adminActor, input());
    const step = async (action: "approve" | "reject" | "cancel" | "reopen", reason?: string, actor: Actor = adminActor) =>
      (quotation = await changeQuotationStatus(actor, quotation.id, { action, version: quotation.updatedAt, reason }));

    await expect(step("approve", undefined, clerk)).rejects.toMatchObject({ status: 403 });
    await expect(step("cancel")).rejects.toMatchObject({ status: 409 });
    await expect(step("reject")).rejects.toMatchObject({ status: 400 });
    await step("reject", "Price too high");
    expect(quotation).toMatchObject({ status: "LOST", lostReason: "Price too high" });
    await step("reopen");
    expect(quotation).toMatchObject({ status: "DRAFT", lostReason: null });
    await step("approve");
    expect(quotation.status).toBe("SUBMITTED");
    await step("cancel");
    expect(quotation.status).toBe("CANCELLED");
    expect(quotation.cancelledAt).not.toBeNull();
  });

  it("deletes pending quotations", async () => {
    const draft = await createQuotation(adminActor, input());
    await deleteQuotation(adminActor, draft.id);
    await expect(getQuotation(adminActor, draft.id)).rejects.toMatchObject({ status: 404 });
  });

  it("filters the list by office, dates, status and search; exports Excel and PDF", async () => {
    const early = await createQuotation(adminActor, input({ quotationDate: "2026-10-01", validTill: "2026-10-05", lines: [{ itemId, qty: 1, rate: 10 }] }));
    await changeQuotationStatus(adminActor, early.id, { action: "approve", version: early.updatedAt });
    const current = await createQuotation(adminActor, input());
    await changeQuotationStatus(adminActor, current.id, { action: "approve", version: current.updatedAt });
    await createQuotation(adminActor, input());

    const today = "2026-10-11";
    const numbers = async (query: object) => (await listQuotations(adminActor, { today, ...query })).map((row) => row.number);
    expect(await numbers({})).toEqual(["SQ-MG260000003", "SQ-MG260000002", "SQ-MG260000001"]);
    expect(await numbers({ status: "EXPIRED" })).toEqual(["SQ-MG260000001"]);
    expect(await numbers({ status: "SUBMITTED" })).toEqual(["SQ-MG260000002"]);
    expect(await numbers({ status: "DRAFT" })).toEqual(["SQ-MG260000003"]);
    expect(await numbers({ from: "2026-10-02", to: "2026-10-31" })).toEqual(["SQ-MG260000003", "SQ-MG260000002"]);
    expect(await numbers({ search: "vai vai" })).toHaveLength(3);
    expect(await numbers({ search: "000002" })).toEqual(["SQ-MG260000002"]);
    expect(await numbers({ officeId: otherUnitOfficeId })).toEqual([]);
    expect(await listQuotations(scopedActor([OTHER_COMPANY]), { today })).toEqual([]);

    const [row] = await listQuotations(scopedActor([companyId]), { today, status: "DRAFT" });
    expect(row).toMatchObject({ officeName: "Head Office", customerName: "Vai Vai Traders", contactMobile: "01700000000" });

    expect(Buffer.from((await quotationsExcel(adminActor, { today })).slice(0, 2)).toString()).toBe("PK");
    const pdf = await quotationPdf(adminActor, current.id);
    expect(pdf.number).toBe("SQ-MG260000002");
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
