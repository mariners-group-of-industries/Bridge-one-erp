import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { money } from "../../dashboard/lib/aggregate";
import { toDbDate } from "../../lib/dates";
import { customerBalances } from "../../lib/receivables";
import { requireBusinessUnit, scopedBusinessUnitIds } from "../../lib/scope";
import { formatNumber, nextNumber } from "../../lib/sequence";
import {
  customerGroupInputSchema,
  deliveryReasonInputSchema,
  customerInputSchema,
  customerUpdateSchema,
  itemCategoryInputSchema,
  itemInputSchema,
  itemUpdateSchema,
  priceListInputSchema,
  returnReasonInputSchema,
  salesAreaInputSchema,
  salesPersonInputSchema,
  salesPersonUpdateSchema,
  setupUpdateSchema,
  type CustomerCredit,
  type CustomerOption,
  type ItemOption,
  type SalesLookups,
  type SalesPersonOption,
  type SetupKind,
  type SetupLookups,
} from "../schemas/masters.schema";

/** Rows a picker loads at once; masters beyond this need a search API. */
const OPTION_LIMIT = 5000;

const isUnique = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
const isInUse = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";

/** Maps unique violations to a readable 409. */
async function guardUnique<T>(entity: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isUnique(error)) throw conflict(`A ${entity} with this code or name already exists.`);
    throw error;
  }
}

/** Loads a record's business unit and checks the actor may access it. */
async function requireOwned(
  actor: Actor,
  find: Promise<{ businessUnitId: string; businessUnit: { companyId: string } } | null>,
  entity: string,
): Promise<string> {
  const record = await find;
  if (!record) throw notFound(entity);
  assertCompanyAccess(actor, record.businessUnit.companyId, entity);
  return record.businessUnitId;
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

function numberedTerms(terms: { businessUnitId: string; content: string }[]): Record<string, string> {
  const grouped = new Map<string, string[]>();
  for (const term of terms) grouped.set(term.businessUnitId, [...(grouped.get(term.businessUnitId) ?? []), term.content]);
  return Object.fromEntries(
    [...grouped].map(([unitId, lines]) => [unitId, lines.map((line, index) => `${index + 1}. ${line}`).join("\n")]),
  );
}

export async function getSalesLookups(actor: Actor): Promise<SalesLookups> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const termsFor = (documentType: "SALES_QUOTATION" | "SALES_ORDER") =>
    db().termsCondition.findMany({
      where: { businessUnitId: { in: unitIds }, domain: "SALES", isDefault: true, applicability: { some: { documentType } } },
      select: { businessUnitId: true, content: true },
      orderBy: { sortOrder: "asc" },
    });
  const [offices, quotationTerms, orderTerms] = await Promise.all([
    db().office.findMany({
      where: { businessUnitId: { in: unitIds } },
      select: { id: true, name: true, address: true, businessUnitId: true, businessUnit: { select: { name: true } } },
      orderBy: [{ businessUnit: { name: "asc" } }, { name: "asc" }],
    }),
    termsFor("SALES_QUOTATION"),
    termsFor("SALES_ORDER"),
  ]);
  return {
    offices: offices.map((office) => ({
      id: office.id,
      name: office.name,
      address: office.address,
      businessUnitId: office.businessUnitId,
      businessUnitName: office.businessUnit.name,
    })),
    quotationTerms: numberedTerms(quotationTerms),
    orderTerms: numberedTerms(orderTerms),
  };
}

/** Setup masters of one business unit, or of every unit in scope (list filters). */
export async function getSetupLookups(actor: Actor, businessUnitId?: string): Promise<SetupLookups> {
  const unitIds = await scopedBusinessUnitIds(actor, businessUnitId);
  const where = { businessUnitId: { in: unitIds } };
  const [customerGroups, areas, categories, priceLists, salesPersons, deliveryReasons, returnReasons] = await Promise.all([
    db().customerGroup.findMany({ where, select: { id: true, businessUnitId: true, name: true }, orderBy: { name: "asc" } }),
    db().salesArea.findMany({
      where,
      select: { id: true, businessUnitId: true, name: true, kind: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    db().itemCategory.findMany({
      where,
      select: { id: true, businessUnitId: true, name: true, parentId: true, level: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    db().priceList.findMany({
      where,
      select: { id: true, businessUnitId: true, name: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db().salesPerson.findMany({
      where: { ...where, isActive: true },
      select: { id: true, businessUnitId: true, name: true, code: true, designation: true },
      orderBy: { name: "asc" },
    }),
    db().deliveryPendingReason.findMany({ where, select: { id: true, businessUnitId: true, name: true }, orderBy: { name: "asc" } }),
    db().salesReturnReason.findMany({ where, select: { id: true, businessUnitId: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Sales Setup: nodes of the layers above each unit's Territory layer.
  const territoryLayers = await db().salesTerritoryLayer.findMany({ where: { ...where, isTerritory: true }, select: { businessUnitId: true, level: true } });
  const groupNodes = territoryLayers.length
    ? await db().salesTerritoryNode.findMany({
        where: { isActive: true, OR: territoryLayers.map((layer) => ({ businessUnitId: layer.businessUnitId, layer: { level: { lt: layer.level } } })) },
        select: { id: true, businessUnitId: true, name: true, layer: { select: { name: true, level: true } } },
        orderBy: [{ layer: { level: "asc" } }, { name: "asc" }],
      })
    : [];
  const territoryGroups = groupNodes.map((node) => ({ id: node.id, businessUnitId: node.businessUnitId, name: node.name, layer: node.layer.name }));
  return { customerGroups, areas, categories, priceLists, salesPersons, deliveryReasons, returnReasons, territoryGroups };
}

// ─── Codes ───────────────────────────────────────────────────────────────────

async function withCode<T>(
  businessUnitId: string,
  code: string | null,
  docType: string,
  prefix: string,
  entity: string,
  create: (tx: Prisma.TransactionClient, code: string) => Promise<T>,
): Promise<T> {
  return guardUnique(entity, () =>
    db().$transaction(async (tx) =>
      create(tx, code ?? formatNumber(prefix, 0, await nextNumber(tx, businessUnitId, docType, 0))),
    ),
  );
}

/** Every referenced id must belong to the business unit (and match the area kind). */
async function assertReferences(
  businessUnitId: string,
  refs: {
    salesPersonId?: string | null;
    customerGroupId?: string | null;
    areas?: { id: string | null; kind: "ZONE" | "TERRITORY" | "ROUTE" | "SECTION" }[];
    categoryId?: string | null;
    priceListIds?: string[];
  },
) {
  const checks: Promise<void>[] = [];
  const expect = (found: Promise<unknown>, message: string) =>
    checks.push(found.then((record) => (record ? undefined : Promise.reject(badRequest(message)))));
  if (refs.salesPersonId) {
    expect(db().salesPerson.findFirst({ where: { id: refs.salesPersonId, businessUnitId } }), "Sales person not found in this business unit.");
  }
  if (refs.customerGroupId) {
    expect(db().customerGroup.findFirst({ where: { id: refs.customerGroupId, businessUnitId } }), "Customer group not found in this business unit.");
  }
  for (const area of refs.areas ?? []) {
    if (area.id) {
      expect(
        db().salesArea.findFirst({ where: { id: area.id, businessUnitId, kind: area.kind } }),
        `${area.kind[0]}${area.kind.slice(1).toLowerCase()} not found in this business unit.`,
      );
    }
  }
  if (refs.categoryId) {
    expect(db().itemCategory.findFirst({ where: { id: refs.categoryId, businessUnitId } }), "Category not found in this business unit.");
  }
  if (refs.priceListIds?.length) {
    checks.push(
      db()
        .priceList.count({ where: { id: { in: refs.priceListIds }, businessUnitId } })
        .then((count) => {
          if (count !== new Set(refs.priceListIds).size) throw badRequest("Price type not found in this business unit.");
        }),
    );
  }
  await Promise.all(checks);
}

// ─── Customers ───────────────────────────────────────────────────────────────

const customerSelect = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  contactPerson: true,
  binNumber: true,
  address: true,
  customerType: true,
  customerGroupId: true,
  zoneId: true,
  territoryId: true,
  routeId: true,
  sectionId: true,
  salesPersonId: true,
  creditDays: true,
  creditLimit: true,
  isActive: true,
  isAnonymous: true,
  addresses: {
    select: { id: true, label: true, address: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.CustomerSelect;

function toCustomer(record: Prisma.CustomerGetPayload<{ select: typeof customerSelect }>): CustomerOption {
  return { ...record, creditLimit: record.creditLimit?.toNumber() ?? null };
}

type CustomerData = ReturnType<typeof customerUpdateSchema.parse>;

function customerRefs(input: CustomerData) {
  return {
    salesPersonId: input.salesPersonId,
    customerGroupId: input.customerGroupId,
    areas: [
      { id: input.zoneId, kind: "ZONE" as const },
      { id: input.territoryId, kind: "TERRITORY" as const },
      { id: input.routeId, kind: "ROUTE" as const },
      { id: input.sectionId, kind: "SECTION" as const },
    ],
  };
}

/** With addresses but none marked default, the first one becomes the default. */
function normaliseAddresses(addresses: CustomerData["addresses"]) {
  const hasDefault = addresses.some((address) => address.isDefault);
  return addresses.map((address, index) => ({ ...address, isDefault: hasDefault ? address.isDefault : index === 0 }));
}

export async function listCustomers(actor: Actor, businessUnitId: string, includeInactive = false): Promise<CustomerOption[]> {
  await requireBusinessUnit(actor, businessUnitId);
  const customers = await db().customer.findMany({
    where: { businessUnitId, ...(includeInactive ? {} : { isActive: true }) },
    select: customerSelect,
    orderBy: { name: "asc" },
    take: OPTION_LIMIT,
  });
  return customers.map(toCustomer);
}

export async function createCustomer(actor: Actor, raw: unknown): Promise<CustomerOption> {
  const { businessUnitId, addresses, ...input } = customerInputSchema.parse(raw);
  await requireBusinessUnit(actor, businessUnitId);
  await assertReferences(businessUnitId, customerRefs({ ...input, addresses }));
  const created = await withCode(businessUnitId, input.code, "CUSTOMER", "CUST", "customer", (tx, code) =>
    tx.customer.create({
      data: {
        ...input,
        businessUnitId,
        code,
        addresses: { create: normaliseAddresses(addresses).map(({ label, address, isDefault }) => ({ label, address, isDefault })) },
      },
      select: customerSelect,
    }),
  );
  return toCustomer(created);
}

export async function updateCustomer(actor: Actor, id: string, raw: unknown): Promise<CustomerOption> {
  const { addresses, ...input } = customerUpdateSchema.parse(raw);
  const businessUnitId = await requireOwned(
    actor,
    db().customer.findUnique({ where: { id }, select: { businessUnitId: true, businessUnit: { select: { companyId: true } } } }),
    "Customer",
  );
  await assertReferences(businessUnitId, customerRefs({ ...input, addresses }));
  const normalised = normaliseAddresses(addresses);
  const keepIds = normalised.flatMap((address) => (address.id ? [address.id] : []));

  const updated = await guardUnique("customer", () =>
    db().$transaction(async (tx) => {
      const existing = await tx.customer.findUniqueOrThrow({ where: { id }, select: { code: true } });
      await tx.customerAddress.deleteMany({ where: { customerId: id, id: { notIn: keepIds } } });
      // Clear defaults first so the one-default index never sees two at once.
      await tx.customerAddress.updateMany({ where: { customerId: id }, data: { isDefault: false } });
      for (const { id: addressId, ...address } of normalised) {
        if (addressId) {
          const { count } = await tx.customerAddress.updateMany({ where: { id: addressId, customerId: id }, data: address });
          if (count === 0) throw badRequest("An address does not belong to this customer.");
        } else {
          await tx.customerAddress.create({ data: { ...address, customerId: id } });
        }
      }
      return tx.customer.update({
        where: { id },
        data: { ...input, code: input.code ?? existing.code },
        select: customerSelect,
      });
    }),
  );
  return toCustomer(updated);
}

/** Credit position of a customer as of `asOf` ("YYYY-MM-DD"). */
export async function getCustomerCredit(actor: Actor, id: string, asOf: string): Promise<CustomerCredit> {
  const customer = await db().customer.findUnique({
    where: { id },
    select: { businessUnitId: true, creditLimit: true, businessUnit: { select: { companyId: true } } },
  });
  if (!customer) throw notFound("Customer");
  assertCompanyAccess(actor, customer.businessUnit.companyId, "Customer");

  const [balances, openOrders] = await Promise.all([
    customerBalances({ businessUnitIds: [customer.businessUnitId], asOf: toDbDate(asOf), customerIds: [id] }),
    openOrderValue(id),
  ]);
  const balance = balances.get(id);
  const creditLimit = customer.creditLimit?.toNumber() ?? null;
  const outstanding = balance?.outstanding ?? 0;
  return {
    creditLimit,
    outstanding,
    overdue: balance?.overdue ?? 0,
    openOrders,
    available: creditLimit === null ? null : money(creditLimit - outstanding - openOrders),
  };
}

/**
 * Undelivered value of a customer's submitted orders, pro rata by remaining
 * quantity. `excludeOrderId` leaves out the order being checked.
 */
export async function openOrderValue(customerId: string, excludeOrderId?: string): Promise<number> {
  const orders = await db().salesOrder.findMany({
    where: {
      customerId,
      status: { in: ["PENDING_APPROVAL", "APPROVED"] },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: { salesTotal: true, lines: { select: { qty: true, deliveredQty: true } } },
  });
  let total = 0;
  for (const order of orders) {
    const qty = order.lines.reduce((sum, line) => sum + line.qty.toNumber(), 0);
    const remaining = order.lines.reduce((sum, line) => sum + line.qty.toNumber() - line.deliveredQty.toNumber(), 0);
    total += qty > 0 ? (order.salesTotal.toNumber() * remaining) / qty : 0;
  }
  return money(total);
}

// ─── Items ───────────────────────────────────────────────────────────────────

const itemSelect = {
  id: true,
  code: true,
  name: true,
  printedCode: true,
  printedName: true,
  uom: true,
  altUom: true,
  altUomFactor: true,
  categoryId: true,
  itemType: true,
  brand: true,
  purchasePrice: true,
  mrp: true,
  vatPercent: true,
  deliveryTolerancePercent: true,
  salesRate: true,
  isActive: true,
  prices: { select: { priceListId: true, rate: true } },
} satisfies Prisma.ItemSelect;

function toItem({ purchasePrice, ...record }: Prisma.ItemGetPayload<{ select: typeof itemSelect }>): ItemOption {
  return {
    ...record,
    costPrice: purchasePrice?.toNumber() ?? null,
    altUomFactor: record.altUomFactor?.toNumber() ?? null,
    mrp: record.mrp?.toNumber() ?? null,
    vatPercent: record.vatPercent.toNumber(),
    deliveryTolerancePercent: record.deliveryTolerancePercent.toNumber(),
    salesRate: record.salesRate.toNumber(),
    prices: Object.fromEntries(record.prices.map((price) => [price.priceListId, price.rate.toNumber()])),
  };
}

export async function listItems(actor: Actor, businessUnitId: string, includeInactive = false): Promise<ItemOption[]> {
  await requireBusinessUnit(actor, businessUnitId);
  const items = await db().item.findMany({
    where: { businessUnitId, ...(includeInactive ? {} : { isActive: true }) },
    select: itemSelect,
    orderBy: { name: "asc" },
    take: OPTION_LIMIT,
  });
  return items.map(toItem);
}

export async function createItem(actor: Actor, raw: unknown): Promise<ItemOption> {
  const { businessUnitId, prices, ...input } = itemInputSchema.parse(raw);
  await requireBusinessUnit(actor, businessUnitId);
  await assertReferences(businessUnitId, { categoryId: input.categoryId, priceListIds: prices.map((price) => price.priceListId) });
  const item = await withCode(businessUnitId, input.code, "ITEM", "ITEM", "item", (tx, code) =>
    tx.item.create({ data: { ...input, businessUnitId, code, prices: { create: prices } }, select: itemSelect }),
  );
  return toItem(item);
}

export async function updateItem(actor: Actor, id: string, raw: unknown): Promise<ItemOption> {
  const { prices, ...input } = itemUpdateSchema.parse(raw);
  const businessUnitId = await requireOwned(
    actor,
    db().item.findUnique({ where: { id }, select: { businessUnitId: true, businessUnit: { select: { companyId: true } } } }),
    "Item",
  );
  await assertReferences(businessUnitId, { categoryId: input.categoryId, priceListIds: prices.map((price) => price.priceListId) });
  const item = await guardUnique("item", () =>
    db().$transaction(async (tx) => {
      const existing = await tx.item.findUniqueOrThrow({ where: { id }, select: { code: true } });
      await tx.itemPrice.deleteMany({ where: { itemId: id } });
      return tx.item.update({
        where: { id },
        data: { ...input, code: input.code ?? existing.code, prices: { create: prices } },
        select: itemSelect,
      });
    }),
  );
  return toItem(item);
}

/** Quantity of an item in submitted orders that is not yet delivered. */
export async function getItemPendingQty(actor: Actor, id: string): Promise<number> {
  await requireOwned(
    actor,
    db().item.findUnique({ where: { id }, select: { businessUnitId: true, businessUnit: { select: { companyId: true } } } }),
    "Item",
  );
  const sum = await db().salesOrderLine.aggregate({
    where: { itemId: id, order: { status: { in: ["PENDING_APPROVAL", "APPROVED"] } } },
    _sum: { qty: true, deliveredQty: true },
  });
  return Math.round(((sum._sum.qty?.toNumber() ?? 0) - (sum._sum.deliveredQty?.toNumber() ?? 0)) * 1000) / 1000;
}

// ─── Sales persons ───────────────────────────────────────────────────────────

const personSelect = { id: true, code: true, name: true, designation: true, phone: true, isActive: true } as const;

export async function listSalesPersons(actor: Actor, businessUnitId: string, includeInactive = false): Promise<SalesPersonOption[]> {
  await requireBusinessUnit(actor, businessUnitId);
  return db().salesPerson.findMany({
    where: { businessUnitId, ...(includeInactive ? {} : { isActive: true }) },
    select: personSelect,
    orderBy: { name: "asc" },
    take: OPTION_LIMIT,
  });
}

export async function createSalesPerson(actor: Actor, raw: unknown): Promise<SalesPersonOption> {
  const { businessUnitId, ...input } = salesPersonInputSchema.parse(raw);
  await requireBusinessUnit(actor, businessUnitId);
  return withCode(businessUnitId, input.code, "SALES_PERSON", "SP", "sales person", (tx, code) =>
    tx.salesPerson.create({ data: { ...input, businessUnitId, code }, select: personSelect }),
  );
}

export async function updateSalesPerson(actor: Actor, id: string, raw: unknown): Promise<SalesPersonOption> {
  const input = salesPersonUpdateSchema.parse(raw);
  await requireOwned(
    actor,
    db().salesPerson.findUnique({ where: { id }, select: { businessUnitId: true, businessUnit: { select: { companyId: true } } } }),
    "Sales person",
  );
  return guardUnique("sales person", async () => {
    const existing = await db().salesPerson.findUniqueOrThrow({ where: { id }, select: { code: true } });
    return db().salesPerson.update({ where: { id }, data: { ...input, code: input.code ?? existing.code }, select: personSelect });
  });
}

// ─── Simple setup masters ────────────────────────────────────────────────────

const ownerSelect = { businessUnitId: true, businessUnit: { select: { companyId: true } } } as const;

export async function createSetupRecord(actor: Actor, kind: SetupKind, raw: unknown): Promise<{ id: string }> {
  switch (kind) {
    case "customer-groups": {
      const input = customerGroupInputSchema.parse(raw);
      await requireBusinessUnit(actor, input.businessUnitId);
      return guardUnique("customer group", () => db().customerGroup.create({ data: input, select: { id: true } }));
    }
    case "areas": {
      const input = salesAreaInputSchema.parse(raw);
      await requireBusinessUnit(actor, input.businessUnitId);
      return guardUnique("area", () => db().salesArea.create({ data: input, select: { id: true } }));
    }
    case "categories": {
      const input = itemCategoryInputSchema.parse(raw);
      await requireBusinessUnit(actor, input.businessUnitId);
      let level = 1;
      if (input.parentId) {
        const parent = await db().itemCategory.findFirst({
          where: { id: input.parentId, businessUnitId: input.businessUnitId },
          select: { level: true },
        });
        if (!parent) throw badRequest("Parent category not found in this business unit.");
        if (parent.level >= 3) throw badRequest("Minor categories cannot have sub-categories.");
        level = parent.level + 1;
      }
      return guardUnique("category", () => db().itemCategory.create({ data: { ...input, level }, select: { id: true } }));
    }
    case "delivery-reasons": {
      const input = deliveryReasonInputSchema.parse(raw);
      await requireBusinessUnit(actor, input.businessUnitId);
      return guardUnique("pending reason", () => db().deliveryPendingReason.create({ data: input, select: { id: true } }));
    }
    case "return-reasons": {
      const input = returnReasonInputSchema.parse(raw);
      await requireBusinessUnit(actor, input.businessUnitId);
      return guardUnique("return reason", () => db().salesReturnReason.create({ data: input, select: { id: true } }));
    }
    case "price-lists": {
      const input = priceListInputSchema.parse(raw);
      await requireBusinessUnit(actor, input.businessUnitId);
      return guardUnique("price type", () =>
        db().$transaction(async (tx) => {
          if (input.isDefault) {
            await tx.priceList.updateMany({ where: { businessUnitId: input.businessUnitId }, data: { isDefault: false } });
          }
          return tx.priceList.create({ data: input, select: { id: true } });
        }),
      );
    }
  }
}

export async function updateSetupRecord(actor: Actor, kind: SetupKind, id: string, raw: unknown): Promise<void> {
  const { name, isDefault } = setupUpdateSchema.parse(raw);
  const where = { where: { id }, select: ownerSelect };
  switch (kind) {
    case "customer-groups":
      await requireOwned(actor, db().customerGroup.findUnique(where), "Customer group");
      await guardUnique("customer group", () => db().customerGroup.update({ where: { id }, data: { name } }));
      return;
    case "areas":
      await requireOwned(actor, db().salesArea.findUnique(where), "Area");
      await guardUnique("area", () => db().salesArea.update({ where: { id }, data: { name } }));
      return;
    case "categories":
      await requireOwned(actor, db().itemCategory.findUnique(where), "Category");
      await guardUnique("category", () => db().itemCategory.update({ where: { id }, data: { name } }));
      return;
    case "delivery-reasons":
      await requireOwned(actor, db().deliveryPendingReason.findUnique(where), "Pending reason");
      await guardUnique("pending reason", () => db().deliveryPendingReason.update({ where: { id }, data: { name } }));
      return;
    case "return-reasons":
      await requireOwned(actor, db().salesReturnReason.findUnique(where), "Return reason");
      await guardUnique("return reason", () => db().salesReturnReason.update({ where: { id }, data: { name } }));
      return;
    case "price-lists": {
      const businessUnitId = await requireOwned(actor, db().priceList.findUnique(where), "Price type");
      await guardUnique("price type", () =>
        db().$transaction(async (tx) => {
          if (isDefault) await tx.priceList.updateMany({ where: { businessUnitId }, data: { isDefault: false } });
          await tx.priceList.update({ where: { id }, data: { name, ...(isDefault === undefined ? {} : { isDefault }) } });
        }),
      );
      return;
    }
  }
}

export async function deleteSetupRecord(actor: Actor, kind: SetupKind, id: string): Promise<void> {
  const where = { where: { id }, select: ownerSelect };
  try {
    switch (kind) {
      case "customer-groups":
        await requireOwned(actor, db().customerGroup.findUnique(where), "Customer group");
        await db().customerGroup.delete({ where: { id } });
        return;
      case "areas":
        await requireOwned(actor, db().salesArea.findUnique(where), "Area");
        await db().salesArea.delete({ where: { id } });
        return;
      case "categories":
        await requireOwned(actor, db().itemCategory.findUnique(where), "Category");
        await db().itemCategory.delete({ where: { id } });
        return;
      case "delivery-reasons":
        // Orders using it fall back to "no reason" (ON DELETE SET NULL).
        await requireOwned(actor, db().deliveryPendingReason.findUnique(where), "Pending reason");
        await db().deliveryPendingReason.delete({ where: { id } });
        return;
      case "return-reasons":
        // Return lines keep the reason text, so removing it changes no history.
        await requireOwned(actor, db().salesReturnReason.findUnique(where), "Return reason");
        await db().salesReturnReason.delete({ where: { id } });
        return;
      case "price-lists":
        await requireOwned(actor, db().priceList.findUnique(where), "Price type");
        if (await db().salesOrder.count({ where: { priceListId: id } })) {
          throw conflict("This price type is used by sales orders and cannot be deleted.");
        }
        await db().priceList.delete({ where: { id } });
        return;
    }
  } catch (error) {
    if (isInUse(error)) throw conflict("This record is in use (by customers, items or sub-categories) and cannot be deleted.");
    throw error;
  }
}
