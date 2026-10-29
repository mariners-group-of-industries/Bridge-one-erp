/**
 * Demo data for trying the Sales pages by hand: one month of quotations, orders,
 * deliveries, returns, collections and a bill, made through the same services
 * the screens use (so stock, dues, order status, dashboard and reports agree).
 *
 * Everything it writes has createdBy = DEMO_ACTOR_ID, so clearSalesDemo()
 * removes exactly that and nothing else. Master data (offices, customers,
 * items, sales force, GL accounts) is read, never changed.
 */
import { createAdvanceVoucher, createBill, createDueCollection } from "@/features/sales/collections/services/collection.service";
import { addPendingNote, confirmDelivery, createDelivery } from "@/features/sales/deliveries/services/delivery.service";
import { adjustStock } from "@/features/sales/deliveries/services/stock.service";
import { createVehicle } from "@/features/sales/deliveries/services/vehicle.service";
import { changeOrderStatus, createOrder } from "@/features/sales/orders/services/order.service";
import { changeQuotationStatus, createQuotation } from "@/features/sales/quotations/services/quotation.service";
import { approveReturn, createReturn, qcMarketReturn, receiveMarketReturn } from "@/features/sales/returns/services/return.service";
import type { Actor, Permission } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

export const DEMO_ACTOR_ID = "demo-seed";

const actor: Actor = {
  id: DEMO_ACTOR_ID,
  name: "Demo Data",
  role: "ADMINISTRATOR",
  isMaster: true,
  permissions: new Set<Permission>(["sales:read", "sales:write", "sales:approve"]),
  companyScope: "ALL",
};

/** "YYYY-MM-DD" of `today` shifted by `days`. */
function shift(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface DemoSummary {
  office: string;
  warehouse: string;
  quotations: string[];
  orders: string[];
  deliveries: string[];
  returns: string[];
  collections: string[];
  bills: string[];
  vehicle: string;
}

/** Writes the demo month ending `today` (local date "YYYY-MM-DD"). Refuses if demo data already exists. */
export async function seedSalesDemo(today: string, log: (line: string) => void = () => undefined): Promise<DemoSummary> {
  const existing = await db().salesOrder.count({ where: { createdBy: DEMO_ACTOR_ID } });
  if (existing > 0) throw new Error("Demo data already exists. Run the clear command first.");

  // ── Pick master data ──
  const office = await db().office.findFirst({
    where: { warehouses: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, businessUnitId: true, warehouses: { select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1 } },
  });
  if (!office) throw new Error("No office with a warehouse. Add one in Configuration first.");
  const businessUnitId = office.businessUnitId;
  const warehouse = office.warehouses[0];
  const items = await db().item.findMany({
    where: { businessUnitId, isActive: true, salesRate: { gt: 0 } },
    select: { id: true, name: true, salesRate: true, vatPercent: true },
    orderBy: { code: "asc" },
    take: 6,
  });
  const customers = await db().customer.findMany({
    where: { businessUnitId, isActive: true, isAnonymous: false },
    select: { id: true, name: true },
    orderBy: { code: "asc" },
    take: 6,
  });
  const month = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const targeted = await db().salesTarget.findMany({ where: { businessUnitId, month }, select: { salesPersonId: true }, distinct: ["salesPersonId"], take: 3 });
  const persons = targeted.length
    ? targeted.map((row) => row.salesPersonId)
    : (await db().salesPerson.findMany({ where: { businessUnitId, isActive: true }, select: { id: true }, take: 3 })).map((row) => row.id);
  const accounts = await db().account.findMany({ where: { isGroup: false, status: "ACTIVE" }, select: { id: true }, orderBy: { code: "asc" }, take: 2 });
  const driver = await db().employee.findFirst({ where: { isActive: true, office: { businessUnitId } }, select: { id: true } });
  const reason = (await db().salesReturnReason.findFirst({ where: { businessUnitId }, select: { name: true } }))?.name ?? "Damaged";
  if (items.length < 4) throw new Error("Need at least 4 active items with a sales rate.");
  if (customers.length < 3) throw new Error("Need at least 3 active customers.");
  if (persons.length === 0) throw new Error("Need at least one sales force.");
  if (accounts.length === 0) throw new Error("Need at least one active GL account (Accounts › Chart of Accounts).");
  log(`Office ${office.name}, warehouse ${warehouse.name}: ${items.length} items, ${customers.length} customers, ${persons.length} sales force.`);

  const person = (index: number) => persons[index % persons.length];
  const item = (index: number) => items[index % items.length];
  const rate = (index: number) => item(index).salesRate.toNumber();
  const vat = (index: number) => item(index).vatPercent.toNumber();
  const day = (offset: number) => shift(today, offset);
  const monthStart = `${today.slice(0, 7)}-01`;
  const summary: DemoSummary = { office: office.name, warehouse: warehouse.name, quotations: [], orders: [], deliveries: [], returns: [], collections: [], bills: [], vehicle: "" };

  // ── Opening stock so deliveries can go out ──
  for (const candidate of items) {
    await adjustStock(actor, { warehouseId: warehouse.id, itemId: candidate.id, qty: 5000, source: "OPENING", postingDate: monthStart, remarks: "Demo opening stock" });
  }
  log("Opening stock: 5,000 of each item.");

  // ── Vehicle ──
  const vehicle = await createVehicle(actor, {
    businessUnitId,
    vehicleNumber: "DEMO DHAKA METRO-TA 11-2233",
    vehicleSize: "3 Ton",
    vehicleName: "Tata 709",
    serviceProvider: "Own",
    isRent: false,
    isCargo: true,
    driverEmployeeId: driver?.id ?? null,
    securityCode: "4455",
    compartments: [{ compartmentType: "Cargo", compartmentName: "Body", capacity: 3000, uom: "KG" }],
  });
  summary.vehicle = vehicle.vehicleNumber;

  // ── Quotations: pending, approved, ordered, rejected ──
  const quotation = async (customerIndex: number, itemIndexes: number[], offset: number) =>
    createQuotation(actor, {
      officeId: office.id,
      customerId: customers[customerIndex].id,
      salesPersonId: person(customerIndex),
      quotationDate: day(offset),
      validTill: day(offset + 20),
      quotationType: "Quotation",
      includingVat: true,
      subject: "Demo price offer",
      lines: itemIndexes.map((index) => ({ itemId: item(index).id, qty: 100 + index * 20, rate: rate(index), vatPercent: vat(index) })),
    });
  const pendingQuotation = await quotation(0, [0, 1], -2);
  const approvedQuotation = await quotation(1, [2], -6);
  await changeQuotationStatus(actor, approvedQuotation.id, { action: "approve", version: approvedQuotation.updatedAt });
  const orderedQuotation = await quotation(2, [0, 3], -20);
  const orderedApproved = await changeQuotationStatus(actor, orderedQuotation.id, { action: "approve", version: orderedQuotation.updatedAt });
  const rejected = await quotation(1, [1], -10);
  await changeQuotationStatus(actor, rejected.id, { action: "reject", version: rejected.updatedAt, reason: "Price too high (demo)" });
  summary.quotations.push(pendingQuotation.number, approvedQuotation.number, orderedQuotation.number, rejected.number);
  log(`Quotations: ${summary.quotations.join(", ")}.`);

  // ── Sales orders ──
  const order = async (customerIndex: number, lines: [number, number][], offset: number, paymentMethod: "CASH" | "CREDIT", quotationId: string | null = null) =>
    createOrder(actor, {
      officeId: office.id,
      customerId: customers[customerIndex].id,
      salesPersonId: person(customerIndex),
      quotationId,
      orderType: "SALES",
      paymentMethod,
      orderDate: day(offset),
      expectedDeliveryDate: day(offset + 2),
      priceIncludesVat: true,
      isForeign: false,
      paymentTermDays: paymentMethod === "CREDIT" ? 15 : 0,
      dueLimit: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
      remarks: "Demo order",
      lines: lines.map(([index, qty]) => ({ itemId: item(index).id, qty, unitPrice: rate(index), discountPercent: 0, vatPercent: vat(index), aitPercent: 0 })),
    });
  const submit = async (draft: Awaited<ReturnType<typeof order>>, offset: number) =>
    changeOrderStatus(actor, draft.id, { action: "submit", version: draft.updatedAt, today: day(offset) });

  const fromQuotation = await submit(await order(2, [[0, 100], [3, 140]], -19, "CASH", orderedApproved.id), -19); // fully delivered below
  const partial = await submit(await order(0, [[0, 200], [1, 120]], -12, "CREDIT"), -12); // partly delivered
  const waiting = await submit(await order(1, [[2, 150]], -5, "CREDIT"), -5); // approved, not delivered
  const draft = await order(3 % customers.length, [[1, 60]], -1, "CASH"); // still a draft
  summary.orders.push(fromQuotation.number, partial.number, waiting.number, draft.number);
  log(`Orders: ${summary.orders.join(", ")}.`);

  await addPendingNote(actor, waiting.id, { reason: "Vehicle not available (demo)" });
  await addPendingNote(actor, partial.id, { reason: "Customer asked to wait (demo)" });

  // ── Deliveries ──
  const header = (offset: number, paymentMethod: "CASH" | "CREDIT") => ({
    officeId: office.id,
    warehouseId: warehouse.id,
    deliveryDate: day(offset),
    deliveryTime: "10:30",
    paymentMethod,
    paymentTermDays: paymentMethod === "CREDIT" ? 15 : 0,
    deliveryCharge: 0,
    unloadingCharge: 0,
    vehicleId: vehicle.id,
    driverEmployeeId: driver?.id ?? null,
    securityCode: "4455",
  });
  const full = await createDelivery(actor, {
    deliveryType: "SALES_ORDER",
    salesOrderId: fromQuotation.id,
    ...header(-18, "CASH"),
    paidAmount: 0,
    lines: fromQuotation.lines.map((line) => ({ orderLineId: line.id, qty: line.qty })),
  });
  await confirmDelivery(actor, full.id, { version: full.updatedAt, actualDeliveryDate: day(-17) });
  const part = await createDelivery(actor, {
    deliveryType: "SALES_ORDER",
    salesOrderId: partial.id,
    ...header(-10, "CREDIT"),
    paidAmount: 0,
    lines: [{ orderLineId: partial.lines[0].id, qty: 120 }],
  });
  const direct = await createDelivery(actor, {
    deliveryType: "DIRECT",
    customerId: customers[1].id,
    salesPersonId: person(1),
    priceIncludesVat: true,
    discountAmount: 0,
    ...header(-7, "CASH"),
    buyerName: "Demo walk-in buyer",
    buyerMobile: "01700000000",
    paidAmount: Math.round(rate(1) * 30 * 0.5),
    lines: [{ itemId: item(1).id, qty: 30, unitPrice: rate(1), discountPercent: 0, vatPercent: vat(1), aitPercent: 0 }],
  });
  const exchange = await createDelivery(actor, {
    deliveryType: "EXCHANGE",
    customerId: customers[0].id,
    salesPersonId: person(0),
    priceIncludesVat: true,
    discountAmount: 0,
    reason: "Damaged packets (demo)",
    ...header(-3, "CREDIT"),
    paidAmount: 0,
    receivedLines: [{ itemId: item(2).id, qty: 10, rate: rate(2) }],
    lines: [{ itemId: item(2).id, qty: 12, unitPrice: rate(2), discountPercent: 0, vatPercent: vat(2), aitPercent: 0 }],
  });
  const recent = await createDelivery(actor, {
    deliveryType: "DIRECT",
    customerId: customers[2].id,
    salesPersonId: person(2),
    priceIncludesVat: true,
    discountAmount: 0,
    ...header(-1, "CREDIT"),
    paidAmount: 0,
    lines: [
      { itemId: item(0).id, qty: 80, unitPrice: rate(0), discountPercent: 0, vatPercent: vat(0), aitPercent: 0 },
      { itemId: item(3).id, qty: 40, unitPrice: rate(3), discountPercent: 0, vatPercent: vat(3), aitPercent: 0 },
    ],
  });
  summary.deliveries.push(full.number, part.number, direct.number, exchange.number, recent.number);
  log(`Deliveries: ${summary.deliveries.join(", ")}.`);

  // ── Returns: partial (approved), without reference (pending), market (approved → received → QC) ──
  const partialReturn = await createReturn(actor, {
    mode: "PARTIAL",
    deliveryId: full.id,
    officeId: office.id,
    warehouseId: warehouse.id,
    returnDate: day(-15),
    lines: [{ deliveryLineId: full.lines[0].id, qty: 10, reason }],
  });
  await approveReturn(actor, partialReturn.id, { version: partialReturn.updatedAt });
  const withoutRef = await createReturn(actor, {
    mode: "WITHOUT_REFERENCE",
    kind: "SALES",
    customerId: customers[1].id,
    priceIncludesVat: true,
    withoutInvoice: false,
    officeId: office.id,
    warehouseId: warehouse.id,
    returnDate: day(-2),
    refNo: "DEMO-RET-1",
    lines: [{ itemId: item(1).id, qty: 6, rate: rate(1), vatPercent: vat(1), reason }],
  });
  const market = await createReturn(actor, {
    mode: "WITHOUT_REFERENCE",
    kind: "MARKET",
    customerId: customers[0].id,
    priceIncludesVat: true,
    withoutInvoice: true,
    officeId: office.id,
    warehouseId: warehouse.id,
    returnDate: day(-4),
    lines: [{ itemId: item(0).id, qty: 12, rate: rate(0), vatPercent: 0, reason }],
  });
  const marketApproved = await approveReturn(actor, market.id, { version: market.updatedAt });
  const received = await receiveMarketReturn(actor, market.id, { version: marketApproved.updatedAt, lines: [{ lineId: marketApproved.lines[0].id, qty: 12 }] });
  await qcMarketReturn(actor, market.id, { version: received.updatedAt, lines: [{ lineId: received.lines[0].id, qty: 10 }] });
  summary.returns.push(partialReturn.number, withoutRef.number, market.number);
  log(`Returns: ${summary.returns.join(", ")}.`);

  // ── Collections: due collection (with bank deduction) and an advance voucher ──
  const partDue = part.totalAmount;
  const collected = await createDueCollection(actor, {
    officeId: office.id,
    collectionDate: day(-6),
    method: "BANK",
    bankName: "Dutch-Bangla Bank",
    reference: "DEMO-TRX-1",
    moneyReceiptNo: "DEMO-MR-1",
    salesPersonId: person(0),
    adjustAccountId: accounts[0].id,
    remarks: "Demo collection",
    deductions: accounts[1] ? [{ expense: "Bank charge (demo)", accountId: accounts[1].id, amount: 50 }] : [],
    rows: [{ customerId: customers[0].id, allocations: [{ deliveryId: part.id, amount: Math.round(partDue * 0.6) }] }],
  });
  const advance = await createAdvanceVoucher(actor, {
    officeId: office.id,
    collectionDate: day(-4),
    employeeId: driver?.id ?? null,
    voucherType: "CASH_RECEIVE",
    narration: "Demo advance",
    cashAccountId: accounts[0].id,
    rows: [
      { customerId: customers[1].id, salesOrderId: waiting.id, amount: 5000, adjustmentAmount: 0, remarks: "Against order" },
      { customerId: customers[2].id, amount: 3000, adjustmentAmount: 0 },
    ],
  });
  summary.collections.push(...collected.map((row) => row.number), ...advance.map((row) => row.number));
  log(`Collections: ${summary.collections.join(", ")}.`);

  // ── Bill for the newest unpaid invoice ──
  const bill = await createBill(
    actor,
    {
      officeId: office.id,
      customerId: customers[2].id,
      billDate: today,
      billType: "NORMAL",
      terms: "Payment within 15 days (demo).",
      deliveryIds: [recent.id],
      details: [{ deliveryId: recent.id, challanManual: recent.challanNo, grnNumber: "DEMO-GRN-1", submissionDate: today }],
    },
    today,
  );
  summary.bills.push(bill.number);
  log(`Bill: ${bill.number}.`);
  return summary;
}

/** Removes everything the demo wrote (createdBy = DEMO_ACTOR_ID) and nothing else. */
export async function clearSalesDemo(): Promise<Record<string, number>> {
  const who = DEMO_ACTOR_ID;
  return db().$transaction(async (tx) => {
    const counts: Record<string, number> = {};
    const run = async (label: string, sql: string) => {
      counts[label] = await tx.$executeRawUnsafe(sql, who);
    };
    // Money first (it points at invoices), then documents from the newest link back.
    await run("collection allocations", `DELETE FROM sales_collection_allocations WHERE "collectionId" IN (SELECT id FROM sales_collections WHERE "createdBy" = $1) OR "deliveryId" IN (SELECT id FROM sales_deliveries WHERE "createdBy" = $1)`);
    await run("collections", `DELETE FROM sales_collections WHERE "createdBy" = $1`);
    await run("bills", `DELETE FROM sales_bills WHERE "createdBy" = $1`);
    // An exchange must keep its return while submitted; these rows are deleted next anyway.
    await run("exchange links", `UPDATE sales_deliveries SET "exchangeReturnId" = NULL, status = 'CANCELLED' WHERE "createdBy" = $1 AND "exchangeReturnId" IS NOT NULL`);
    await run("returns", `DELETE FROM sales_returns WHERE "createdBy" = $1`);
    await run("deliveries", `DELETE FROM sales_deliveries WHERE "createdBy" = $1`);
    await run("stock entries", `DELETE FROM stock_entries WHERE "createdBy" = $1`);
    await run("orders", `DELETE FROM sales_orders WHERE "createdBy" = $1`);
    await run("quotations", `DELETE FROM sales_quotations WHERE "createdBy" = $1`);
    await run("vehicles", `DELETE FROM vehicles WHERE "createdBy" = $1`);
    // Pending reasons the demo's notes added (named "… (demo)"), if no order still uses them.
    counts["pending reasons"] = await tx.$executeRawUnsafe(
      `DELETE FROM delivery_pending_reasons r WHERE r.name LIKE '%(demo)' AND NOT EXISTS (SELECT 1 FROM sales_orders o WHERE o."deliveryPendingReasonId" = r.id)`,
    );
    return counts;
  }, { timeout: 60_000 });
}
