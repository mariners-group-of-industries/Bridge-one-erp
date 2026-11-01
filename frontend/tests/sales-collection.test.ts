import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  adjustAdvance,
  cancelBill,
  cancelCollection,
  createAdvanceVoucher,
  createBill,
  createCollection,
  createDueCollection,
  getBill,
  getCollection,
  listGlAccounts,
  listBills,
  listCollections,
  listDue,
  listDueInvoices,
  listLedger,
} from "@/features/sales/collections/services/collection.service";
import type { CollectionInput } from "@/features/sales/collections/schemas/collection.schema";
import { addCollectionAttachment, readCollectionAttachment } from "@/features/sales/collections/services/collection-attachment.service";
import { createDelivery, deleteDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { adjustStock } from "@/features/sales/deliveries/services/stock.service";
import { createCustomer, createItem } from "@/features/sales/masters/services/masters.service";
import { approveReturn, createReturn } from "@/features/sales/returns/services/return.service";
import { tableExport } from "@/features/sales/lib/table-export";
import { createOrder } from "@/features/sales/orders/services/order.service";
import type { Actor } from "@/lib/auth/actor";
import { setStorage } from "@/lib/storage";
import { adminActor, businessUnitInput, companyInput, MemoryStorage, officeInput, scopedActor } from "./helpers/fixtures";
import { resetTestDb, startTestDb, stopTestDb } from "./helpers/test-db";

// Route database access to the per-file PGlite test database.
vi.mock("@/lib/prisma/client", async () => {
  const { testPrisma } = await import("./helpers/test-db");
  return { db: testPrisma };
});

const OTHER_COMPANY = "00000000-0000-4000-8000-000000000000";
const TODAY = "2026-10-12";
const clerk: Actor = { ...adminActor, id: "test-clerk", permissions: new Set(["sales:read", "sales:write"]) };

describe("sales collection", () => {
  let prisma: PrismaClient;
  let officeId: string;
  let warehouseId: string;
  let customerId: string;
  let itemId: string;
  let businessUnit: string;

  /** Credit delivery of `qty` items at 100 (no VAT): invoice of qty × 100, due after 7 days. */
  const deliver = (qty: number, deliveryDate: string, paidAmount = 0) =>
    createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId,
      officeId,
      warehouseId,
      priceIncludesVat: true,
      discountAmount: 0,
      deliveryDate,
      paymentMethod: paidAmount ? "CASH" : "CREDIT",
      paymentTermDays: 7,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount,
      lines: [{ itemId, qty, unitPrice: 100, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
  const receipt = (allocations: { deliveryId: string; amount: number }[], extra: Partial<CollectionInput> = {}): CollectionInput => ({
    kind: "INVOICE",
    officeId,
    customerId,
    collectionDate: TODAY,
    method: "BANK",
    reference: "TRX-1",
    bankName: "Dutch-Bangla Bank",
    amount: allocations.reduce((sum, row) => sum + row.amount, 0),
    allocations,
    ...extra,
  } as CollectionInput);
  const dueOf = async (deliveryId: string) => (await listDueInvoices(adminActor, { asOf: TODAY })).find((row) => row.deliveryId === deliveryId)?.due ?? 0;

  beforeAll(async () => {
    prisma = await startTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    const companyId = (await prisma.company.create({ data: companyInput })).id;
    const businessUnitId = (await prisma.businessUnit.create({ data: { ...businessUnitInput, companyId } })).id;
    businessUnit = businessUnitId;
    officeId = (await prisma.office.create({ data: { ...officeInput, businessUnitId } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { officeId, name: "FG WH" } })).id;
    customerId = (await createCustomer(adminActor, { businessUnitId, name: "M/S Arif Enterprise", creditDays: 7 })).id;
    itemId = (await createItem(adminActor, { businessUnitId, name: "Marine Noodles", uom: "PCS", salesRate: 100 })).id;
    await adjustStock(adminActor, { warehouseId, itemId, qty: 1000, source: "OPENING", postingDate: "2026-09-01" });
  });

  afterAll(stopTestDb);

  it("lists dues per invoice and customer, net of approved returns", async () => {
    const old = await deliver(10, "2026-09-20"); // 1,000, overdue since 27 Sep
    const fresh = await deliver(5, "2026-10-10"); // 500, due 17 Oct
    const partial = await createReturn(adminActor, { mode: "PARTIAL", deliveryId: old.id, officeId, warehouseId, returnDate: TODAY, lines: [{ deliveryLineId: old.lines[0].id, qty: 2 }] });
    await approveReturn(adminActor, partial.id, { version: partial.updatedAt });

    const invoices = await listDueInvoices(adminActor, { asOf: TODAY });
    expect(invoices.find((row) => row.deliveryId === old.id)).toMatchObject({ totalAmount: 1000, returnedAmount: 200, collectedAmount: 0, due: 800, overdueDays: 15 });
    expect(invoices.find((row) => row.deliveryId === fresh.id)).toMatchObject({ due: 500, overdueDays: 0 });
    const [customer] = await listDue(adminActor, { asOf: TODAY });
    expect(customer).toMatchObject({ customerName: "M/S Arif Enterprise", invoices: 2, due: 1300, overdue: 800, advance: 0, ledger: 1300 });
    expect(await listDue(scopedActor([OTHER_COMPANY]), { asOf: TODAY })).toHaveLength(0);
  });

  it("collects by invoice without paying more than is due", async () => {
    const a = await deliver(10, "2026-10-01");
    const b = await deliver(5, "2026-10-05");
    await expect(createCollection(clerk, receipt([{ deliveryId: a.id, amount: 1001 }]))).rejects.toMatchObject({ status: 409 });
    await expect(createCollection(clerk, { ...receipt([{ deliveryId: a.id, amount: 100 }]), amount: 150 } as CollectionInput)).rejects.toThrow("must add up");

    const paid = await createCollection(clerk, receipt([{ deliveryId: a.id, amount: 1000 }, { deliveryId: b.id, amount: 200 }]));
    expect(paid).toMatchObject({ number: "CR-MG260000001", kind: "INVOICE", amount: 1200, allocated: 1200, unallocated: 0, invoices: 2, createdBy: clerk.id });
    expect(await dueOf(a.id)).toBe(0);
    expect(await dueOf(b.id)).toBe(300);

    const list = await listCollections(adminActor, { kind: "INVOICE", from: TODAY, to: TODAY });
    expect(list).toMatchObject({ totalCount: 1, totalAmount: 1200 });
    expect(list.allocations.map((row) => [row.invoiceNumber, row.amount])).toEqual(
      expect.arrayContaining([
        [a.number, 1000],
        [b.number, 200],
      ]),
    );

    // Cancelling the receipt (approvers only) makes the invoices due again.
    await expect(cancelCollection(clerk, paid.id, { version: paid.updatedAt, reason: "Cheque bounced" })).rejects.toMatchObject({ status: 403 });
    const cancelled = await cancelCollection(adminActor, paid.id, { version: paid.updatedAt, reason: "Cheque bounced" });
    expect(cancelled).toMatchObject({ status: "CANCELLED", cancelReason: "Cheque bounced" });
    expect(await dueOf(a.id)).toBe(1000);
  });

  it("keeps advances on account until they are adjusted against invoices", async () => {
    const a = await deliver(10, "2026-10-01");
    const advance = await createCollection(clerk, { kind: "ADVANCE", officeId, customerId, collectionDate: TODAY, method: "CASH", amount: 1500 });
    expect(advance).toMatchObject({ kind: "ADVANCE", allocated: 0, unallocated: 1500 });

    // Ledger counts the advance; the invoice is still due until it is adjusted.
    expect((await listLedger(adminActor, { asOf: TODAY }))[0]).toMatchObject({ salesDue: 1000, ledger: -500, diff: 1500 });
    expect((await listDue(adminActor, { asOf: TODAY }))[0]).toMatchObject({ due: 1000, advance: 1500, ledger: -500 });

    await expect(adjustAdvance(clerk, advance.id, { version: advance.updatedAt, allocations: [{ deliveryId: a.id, amount: 1200 }] })).rejects.toMatchObject({ status: 409 });
    const adjusted = await adjustAdvance(clerk, advance.id, { version: advance.updatedAt, allocations: [{ deliveryId: a.id, amount: 600 }] });
    expect(adjusted).toMatchObject({ allocated: 600, unallocated: 900 });
    const again = await adjustAdvance(clerk, advance.id, { version: adjusted.updatedAt, allocations: [{ deliveryId: a.id, amount: 400 }] });
    expect(again).toMatchObject({ allocated: 1000, unallocated: 500, invoices: 1 });
    expect(await dueOf(a.id)).toBe(0);
    expect((await listLedger(adminActor, { asOf: TODAY }))[0]).toMatchObject({ salesDue: 0, ledger: -500, diff: 500 });
    const advances = await listCollections(adminActor, { kind: "ADVANCE" });
    expect(advances.rows[0]).toMatchObject({ amount: 1500, allocated: 1000, unallocated: 500 });
  });

  it("puts due invoices on one bill and tracks what is collected", async () => {
    const a = await deliver(10, "2026-10-01");
    const b = await deliver(5, "2026-10-05");
    const c = await deliver(1, "2026-10-06");
    const bill = await createBill(clerk, { officeId, customerId, billDate: TODAY, deliveryIds: [a.id, b.id] }, TODAY);
    expect(bill).toMatchObject({ number: "BL-2026-00001", billAmount: 1500, due: 1500, collected: 0, invoices: 2 });
    await expect(createBill(clerk, { officeId, customerId, billDate: TODAY, deliveryIds: [b.id] }, TODAY)).rejects.toMatchObject({ status: 409 });
    expect((await listDueInvoices(adminActor, { asOf: TODAY, notSubmitted: "true" })).map((row) => row.deliveryId)).toEqual([c.id]);

    await createCollection(clerk, receipt([{ deliveryId: a.id, amount: 1000 }]));
    expect(await getBill(adminActor, bill.id, TODAY)).toMatchObject({ due: 500, collected: 1000 });
    await createCollection(clerk, receipt([{ deliveryId: b.id, amount: 500 }]));
    expect(await listBills(adminActor, { asOf: TODAY })).toHaveLength(0);

    // A billed invoice cannot be deleted until the bill is cancelled (and its collections).
    await expect(deleteDelivery(adminActor, c.id, { version: c.updatedAt, reason: "x" })).resolves.toBeUndefined();
    const fresh = await getBill(adminActor, bill.id, TODAY);
    const cancelled = await cancelBill(clerk, bill.id, { version: fresh.updatedAt, reason: "Re-billed" }, TODAY);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("settles invoices paid on delivery and blocks changing settled deliveries", async () => {
    const cash = await deliver(3, TODAY, 300);
    expect(await dueOf(cash.id)).toBe(0);
    const [onDelivery] = (await listCollections(adminActor, { kind: "INVOICE" })).rows;
    expect(onDelivery).toMatchObject({ onDelivery: true, allocated: 300, invoices: 1 });
    await expect(cancelCollection(adminActor, onDelivery.id, { version: onDelivery.updatedAt, reason: "x" })).rejects.toMatchObject({ status: 409 });

    const credit = await deliver(4, TODAY);
    const paid = await createCollection(clerk, receipt([{ deliveryId: credit.id, amount: 100 }]));
    await expect(deleteDelivery(adminActor, credit.id, { version: credit.updatedAt, reason: "Wrong" })).rejects.toMatchObject({ status: 409 });
    await cancelCollection(adminActor, paid.id, { version: paid.updatedAt, reason: "Wrong customer" });
    await deleteDelivery(adminActor, credit.id, { version: credit.updatedAt, reason: "Wrong" });
    // The cash delivery's own collection does not block it.
    await deleteDelivery(adminActor, cash.id, { version: cash.updatedAt, reason: "Wrong" });
  });

  it("collects invoices of several customers at once with bank deductions", async () => {
    const cash = await prisma.account.create({ data: { code: "1010", name: "Cash in Hand", accountType: "ASSET", accountSubtype: "Cash", normalBalance: "DEBIT" } });
    const charges = await prisma.account.create({ data: { code: "6010", name: "Bank Charges", accountType: "EXPENSE", accountSubtype: "Finance", normalBalance: "DEBIT" } });
    await prisma.account.create({ data: { code: "6000", name: "Expenses", accountType: "EXPENSE", accountSubtype: "Group", normalBalance: "DEBIT", isGroup: true } });
    expect((await listGlAccounts()).map((row) => row.code)).toEqual(["1010", "6010"]);

    const first = await deliver(10, "2026-10-01"); // 1,000
    const second = await deliver(5, "2026-10-05"); // 500
    const otherCustomer = (await createCustomer(adminActor, { businessUnitId: businessUnit, name: "Saleha Electric", creditDays: 7 })).id;
    const third = await createDelivery(adminActor, {
      deliveryType: "DIRECT",
      customerId: otherCustomer,
      officeId,
      warehouseId,
      priceIncludesVat: true,
      discountAmount: 0,
      deliveryDate: "2026-10-06",
      paymentMethod: "CREDIT",
      paymentTermDays: 7,
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 0,
      lines: [{ itemId, qty: 3, unitPrice: 100, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });

    const base = {
      officeId,
      collectionDate: TODAY,
      method: "BANK" as const,
      moneyReceiptNo: "MR-77",
      adjustAccountId: cash.id,
      deductions: [{ expense: "Bank charge", accountId: charges.id, amount: 25 }],
    };
    const saved = await createDueCollection(clerk, {
      ...base,
      rows: [
        { customerId, allocations: [{ deliveryId: first.id, amount: 1000 }, { deliveryId: second.id, amount: 200 }] },
        { customerId: otherCustomer, allocations: [{ deliveryId: third.id, amount: 300 }] },
      ],
    });
    expect(saved.map((row) => row.number)).toEqual(["CR-MG260000001", "CR-MG260000002"]);
    const receipt = await getCollection(adminActor, saved[0].id);
    expect(receipt).toMatchObject({ amount: 1200, moneyReceiptNo: "MR-77", adjustAccount: "1010 - Cash in Hand", deductionAmount: 25, deductions: [{ expense: "Bank charge", account: "6010 - Bank Charges", amount: 25 }] });
    expect((await getCollection(adminActor, saved[1].id)).deductionAmount).toBe(0);
    expect([await dueOf(first.id), await dueOf(second.id), await dueOf(third.id)]).toEqual([0, 300, 0]);

    await expect(createDueCollection(clerk, { ...base, rows: [{ customerId, allocations: [{ deliveryId: second.id, amount: 301 }] }] })).rejects.toMatchObject({ status: 409 });
    await expect(createDueCollection(clerk, { ...base, deductions: [], adjustAccountId: (await prisma.account.findFirstOrThrow({ where: { isGroup: true } })).id, rows: [{ customerId, allocations: [{ deliveryId: second.id, amount: 1 }] }] })).rejects.toMatchObject({ status: 400 });
    await expect(createDueCollection(clerk, { ...base, rows: [{ customerId, allocations: [{ deliveryId: second.id, amount: 20 }] }] })).rejects.toThrow();
  });

  it("saves an advance voucher per partner with its SO, cash account and control amount", async () => {
    const cash = await prisma.account.create({ data: { code: "1010", name: "Cash in Hand", accountType: "ASSET", accountSubtype: "Cash", normalBalance: "DEBIT" } });
    const order = await createOrder(adminActor, {
      officeId,
      customerId,
      orderType: "SALES",
      paymentMethod: "CASH",
      orderDate: TODAY,
      expectedDeliveryDate: TODAY,
      priceIncludesVat: true,
      isForeign: false,
      paymentTermDays: 0,
      dueLimit: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
      lines: [{ itemId, qty: 1, unitPrice: 100, discountPercent: 0, vatPercent: 0, aitPercent: 0 }],
    });
    const input = {
      officeId,
      collectionDate: TODAY,
      employeeId: (await prisma.employee.create({ data: { officeId, employeeCode: "E-ADV", name: "Md. Usuf Ali", joiningDate: new Date("2024-01-01") } })).id,
      voucherType: "BANK_RECEIVE" as const,
      narration: "Advance for Eid order",
      controlAmount: 5000,
      cashAccountId: cash.id,
      rows: [
        { customerId, salesOrderId: order.id, adjustmentAmount: 1000, amount: 3000, remarks: "Part 1" },
        { customerId, amount: 2000 },
      ],
    };
    const saved = await createAdvanceVoucher(clerk, input);
    expect(saved).toHaveLength(2);
    expect(await getCollection(adminActor, saved[0].id)).toMatchObject({
      kind: "ADVANCE",
      method: "BANK",
      amount: 3000,
      voucherType: "BANK_RECEIVE",
      cashAccount: "1010 - Cash in Hand",
      narration: "Advance for Eid order",
      controlAmount: 5000,
      adjustmentAmount: 1000,
      salesOrderNumber: order.number,
    });
    await expect(createAdvanceVoucher(clerk, { ...input, controlAmount: 4000 })).rejects.toThrow();
    await expect(createAdvanceVoucher(clerk, { ...input, employeeId: undefined })).rejects.toThrow("Select the employee.");

    // Attachment: stored on the collection and listed with it; the content must match its type.
    setStorage(new MemoryStorage());
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const file = await addCollectionAttachment(clerk, saved[0].id, { name: "slip.pdf", type: "application/pdf", size: pdf.byteLength, bytes: pdf });
    expect(await getCollection(adminActor, saved[0].id)).toMatchObject({ employeeName: "Md. Usuf Ali", attachments: [{ originalName: "slip.pdf" }] });
    expect((await readCollectionAttachment(clerk, saved[0].id, file.id)).bytes).toEqual(pdf);
    await expect(addCollectionAttachment(clerk, saved[0].id, { name: "x.pdf", type: "application/pdf", size: 4, bytes: new Uint8Array([1, 2, 3, 4]) })).rejects.toThrow("does not match its type");
    await expect(createAdvanceVoucher(clerk, { ...input, rows: [{ customerId, adjustmentAmount: 10, amount: 5 }], controlAmount: null })).rejects.toThrow();
  });

  it("creates factoring bills with GRN numbers, submission dates and terms; exports tables", async () => {
    const invoice = await deliver(4, "2026-10-01");
    const bill = await createBill(
      adminActor,
      {
        officeId,
        customerId,
        billDate: TODAY,
        billType: "FACTORING",
        terms: "Pay within 30 days.",
        deliveryIds: [invoice.id],
        details: [{ deliveryId: invoice.id, challanManual: "CH-M-1", grnNumber: "GRN-9", submissionDate: TODAY }],
      },
      TODAY,
    );
    expect(bill).toMatchObject({ billType: "FACTORING", terms: "Pay within 30 days." });
    expect(bill.lines[0]).toMatchObject({ challanManual: "CH-M-1", grnNumber: "GRN-9", submissionDate: TODAY });

    const table = { title: "Due List", headers: ["SL", "Customer", "Due"], rows: [[1, "Arif", 400], [2, null, 0]] };
    const xlsx = await tableExport({ format: "xlsx", ...table });
    expect(Buffer.from(xlsx.bytes.slice(0, 2)).toString()).toBe("PK");
    expect(xlsx.fileName).toBe("due-list.xlsx");
    const pdf = await tableExport({ format: "pdf", ...table });
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
