import type { Prisma } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  customerPriceSchema,
  groupPriceSchema,
  type CustomerPriceData,
  type CustomerPriceDto,
  type CustomerPriceInput,
  type CustomerPriceRow,
  type GroupPriceData,
  type GroupPriceDto,
  type GroupPriceInput,
  type GroupPriceRow,
  type PriceListQuery,
  type PriceSetupList,
  type PriceSetupOptions,
} from "../schemas/customer-price.schema";

type Tx = Prisma.TransactionClient;

// ─── Scoping & helpers ────────────────────────────────────────────────────────

export function unitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

async function loadUnit(actor: Actor, businessUnitId: string) {
  const unit = await db().businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true, companyId: true } });
  if (!unit) throw notFound("Business unit");
  assertCompanyAccess(actor, unit.companyId, "Business unit");
}

const orNull = (value: string) => (value === "" ? null : value);
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const toDate = (value: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null);
const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

async function chainOf(categoryId: string | null) {
  const levels: Record<number, string> = {};
  let id = categoryId;
  while (id) {
    const category = await db().itemCategory.findUnique({ where: { id }, select: { id: true, level: true, parentId: true } });
    if (!category) break;
    levels[category.level] = category.id;
    id = category.parentId;
  }
  return { categoryId: levels[1] ?? "", subCategoryId: levels[2] ?? "", minorCategoryId: levels[3] ?? "" };
}

type Filter = { itemType: string; categoryId: string; subCategoryId: string; minorCategoryId: string };
const filterColumns = (data: Filter) => ({
  itemType: orNull(data.itemType),
  categoryId: orNull(data.minorCategoryId || data.subCategoryId || data.categoryId),
});

/** Every referenced record must exist and belong to the setup's business unit. */
async function checkInUnit(tx: Tx, unitId: string, refs: { model: "priceList" | "customer" | "office" | "customerGroup" | "itemCategory" | "item"; ids: string[]; label: string }[]) {
  for (const ref of refs) {
    const ids = [...new Set(ref.ids.filter(Boolean))];
    if (ids.length === 0) continue;
    const delegate = tx[ref.model] as unknown as { findMany: (args: object) => Promise<{ id: string; businessUnitId: string }[]> };
    const found = await delegate.findMany({ where: { id: { in: ids } }, select: { id: true, businessUnitId: true } });
    if (found.length !== ids.length || found.some((row) => row.businessUnitId !== unitId)) throw badRequest(`Select ${ref.label} of this business unit.`);
  }
}

// ─── Lists ────────────────────────────────────────────────────────────────────

/** Customer price setups in scope matching the search (customer or item). Shared with Excel/PDF. */
export function customerPriceWhere(actor: Actor, searchText?: string): Prisma.CustomerPriceSetupWhereInput {
  const search = searchText ? { contains: escapeLike(searchText), mode: "insensitive" as const } : undefined;
  return {
    businessUnit: unitScope(actor),
    ...(search ? { OR: [{ customer: { name: search } }, { customer: { code: search } }, { lines: { some: { item: { OR: [{ name: search }, { code: search }] } } } }] } : {}),
  };
}

/** Customer group price setups in scope matching the search. Shared with Excel/PDF. */
export function groupPriceWhere(actor: Actor, searchText?: string): Prisma.CustomerGroupPriceSetupWhereInput {
  const search = searchText ? { contains: escapeLike(searchText), mode: "insensitive" as const } : undefined;
  return {
    businessUnit: unitScope(actor),
    ...(search
      ? { OR: [{ customerGroup: { name: search } }, { office: { name: search } }, { circularNo: search }, { lines: { some: { item: { OR: [{ name: search }, { code: search }] } } } }] }
      : {}),
  };
}

export async function listCustomerPrices(actor: Actor, query: PriceListQuery): Promise<PriceSetupList<CustomerPriceRow>> {
  const where = customerPriceWhere(actor, query.search);
  const [total, records] = await Promise.all([
    db().customerPriceSetup.count({ where }),
    db().customerPriceSetup.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { customer: { select: { code: true, name: true } }, priceList: { select: { name: true } }, _count: { select: { lines: true } } },
    }),
  ]);
  return {
    rows: records.map((record) => ({
      id: record.id,
      customerCode: record.customer.code,
      customerName: record.customer.name,
      priceListName: record.priceList?.name ?? null,
      itemCount: record._count.lines,
      updatedAt: record.updatedAt.toISOString(),
      isActive: record.isActive,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listGroupPrices(actor: Actor, query: PriceListQuery): Promise<PriceSetupList<GroupPriceRow>> {
  const where = groupPriceWhere(actor, query.search);
  const [total, records] = await Promise.all([
    db().customerGroupPriceSetup.count({ where }),
    db().customerGroupPriceSetup.findMany({
      where,
      orderBy: [{ createDate: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        office: { select: { name: true } },
        customerGroup: { select: { name: true } },
        priceList: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
  ]);
  return {
    rows: records.map((record) => ({
      id: record.id,
      officeName: record.office.name,
      customerGroupName: record.customerGroup.name,
      priceListName: record.priceList?.name ?? null,
      createDate: dateOnly(record.createDate),
      circularNo: record.circularNo,
      itemCount: record._count.lines,
      isRunning: record.isRunning,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

// ─── Customer price ───────────────────────────────────────────────────────────

export async function getCustomerPrice(actor: Actor, id: string): Promise<CustomerPriceDto> {
  const setup = await db().customerPriceSetup.findFirst({
    where: { id, businessUnit: unitScope(actor) },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!setup) throw notFound("Customer price setup");
  return {
    id: setup.id,
    isActive: setup.isActive,
    businessUnitId: setup.businessUnitId,
    priceListId: str(setup.priceListId),
    customerId: setup.customerId,
    itemType: (setup.itemType ?? "") as CustomerPriceDto["itemType"],
    ...(await chainOf(setup.categoryId)),
    lines: setup.lines.map((line) => ({ itemId: line.itemId, dpPrice: line.dpPrice.toString(), tpPrice: line.tpPrice.toString() })),
  };
}

/**
 * Saves a customer's prices. There is one setup per customer and price type, so
 * saving the same pair again replaces that setup's items.
 */
export async function saveCustomerPrice(actor: Actor, input: CustomerPriceInput, id?: string): Promise<CustomerPriceDto> {
  const data: CustomerPriceData = customerPriceSchema.parse(input);
  await loadUnit(actor, data.businessUnitId);
  const savedId = await db().$transaction(async (tx) => {
    await checkInUnit(tx, data.businessUnitId, [
      { model: "priceList", ids: [data.priceListId], label: "a price type" },
      { model: "customer", ids: [data.customerId], label: "a customer" },
      { model: "itemCategory", ids: [data.categoryId, data.subCategoryId, data.minorCategoryId], label: "categories" },
      { model: "item", ids: data.lines.map((l) => l.itemId), label: "items" },
    ]);
    let setupId = id;
    if (id) {
      const existing = await tx.customerPriceSetup.findFirst({ where: { id, businessUnit: unitScope(actor) } });
      if (!existing) throw notFound("Customer price setup");
      const clash = await tx.customerPriceSetup.findFirst({
        where: { customerId: data.customerId, priceListId: orNull(data.priceListId), id: { not: id } },
      });
      if (clash) throw badRequest("This customer already has prices for that price type. Edit that setup instead.");
    } else {
      const existing = await tx.customerPriceSetup.findFirst({ where: { customerId: data.customerId, priceListId: orNull(data.priceListId) } });
      setupId = existing?.id;
    }
    const values = { priceListId: orNull(data.priceListId), customerId: data.customerId, ...filterColumns(data) };
    if (setupId) {
      await tx.customerPriceSetup.update({ where: { id: setupId }, data: values });
      await tx.customerPriceLine.deleteMany({ where: { setupId } });
    } else {
      setupId = (await tx.customerPriceSetup.create({ data: { businessUnitId: data.businessUnitId, ...values } })).id;
    }
    await tx.customerPriceLine.createMany({
      data: data.lines.map((line, sortOrder) => ({ setupId: setupId!, sortOrder, ...line })),
    });
    return setupId!;
  });
  return getCustomerPrice(actor, savedId);
}

export async function setCustomerPriceActive(actor: Actor, id: string, isActive: boolean) {
  const setup = await db().customerPriceSetup.findFirst({ where: { id, businessUnit: unitScope(actor) } });
  if (!setup) throw notFound("Customer price setup");
  return db().customerPriceSetup.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
}

// ─── Customer group price ─────────────────────────────────────────────────────

export async function getGroupPrice(actor: Actor, id: string): Promise<GroupPriceDto> {
  const setup = await db().customerGroupPriceSetup.findFirst({
    where: { id, businessUnit: unitScope(actor) },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!setup) throw notFound("Customer group price setup");
  return {
    id: setup.id,
    businessUnitId: setup.businessUnitId,
    priceListId: str(setup.priceListId),
    officeId: setup.officeId,
    customerGroupId: setup.customerGroupId,
    createDate: dateOnly(setup.createDate),
    circularNo: str(setup.circularNo),
    remarks: str(setup.remarks),
    isRunning: setup.isRunning,
    itemType: (setup.itemType ?? "") as GroupPriceDto["itemType"],
    ...(await chainOf(setup.categoryId)),
    lines: setup.lines.map((line) => ({
      itemId: line.itemId,
      fromDate: dateOnly(line.fromDate),
      toDate: dateOnly(line.toDate),
      fromQty: str(line.fromQty),
      toQty: str(line.toQty),
      dpPrice: line.dpPrice.toString(),
      tpPrice: line.tpPrice.toString(),
    })),
  };
}

export async function saveGroupPrice(actor: Actor, input: GroupPriceInput, id?: string): Promise<GroupPriceDto> {
  const data: GroupPriceData = groupPriceSchema.parse(input);
  await loadUnit(actor, data.businessUnitId);
  const savedId = await db().$transaction(async (tx) => {
    await checkInUnit(tx, data.businessUnitId, [
      { model: "priceList", ids: [data.priceListId], label: "a price type" },
      { model: "office", ids: [data.officeId], label: "an office" },
      { model: "customerGroup", ids: [data.customerGroupId], label: "a customer group" },
      { model: "itemCategory", ids: [data.categoryId, data.subCategoryId, data.minorCategoryId], label: "categories" },
      { model: "item", ids: data.lines.map((l) => l.itemId), label: "items" },
    ]);
    const values = {
      priceListId: orNull(data.priceListId),
      officeId: data.officeId,
      customerGroupId: data.customerGroupId,
      createDate: toDate(data.createDate)!,
      circularNo: orNull(data.circularNo),
      remarks: orNull(data.remarks),
      isRunning: data.isRunning,
      ...filterColumns(data),
    };
    let setupId = id;
    if (id) {
      const existing = await tx.customerGroupPriceSetup.findFirst({ where: { id, businessUnit: unitScope(actor) } });
      if (!existing) throw notFound("Customer group price setup");
      await tx.customerGroupPriceSetup.update({ where: { id }, data: values });
      await tx.customerGroupPriceLine.deleteMany({ where: { setupId: id } });
    } else {
      setupId = (await tx.customerGroupPriceSetup.create({ data: { businessUnitId: data.businessUnitId, ...values } })).id;
    }
    await tx.customerGroupPriceLine.createMany({
      data: data.lines.map((line, sortOrder) => ({
        setupId: setupId!,
        sortOrder,
        itemId: line.itemId,
        fromDate: toDate(line.fromDate),
        toDate: toDate(line.toDate),
        fromQty: orNull(line.fromQty),
        toQty: orNull(line.toQty),
        dpPrice: line.dpPrice,
        tpPrice: line.tpPrice,
      })),
    });
    return setupId!;
  });
  return getGroupPrice(actor, savedId);
}

export async function setGroupPriceRunning(actor: Actor, id: string, isRunning: boolean) {
  const setup = await db().customerGroupPriceSetup.findFirst({ where: { id, businessUnit: unitScope(actor) } });
  if (!setup) throw notFound("Customer group price setup");
  return db().customerGroupPriceSetup.update({ where: { id }, data: { isRunning }, select: { id: true, isRunning: true } });
}

// ─── Options ──────────────────────────────────────────────────────────────────

export async function getPriceSetupOptions(actor: Actor): Promise<PriceSetupOptions> {
  const unit = { businessUnit: unitScope(actor) };
  const bu = { id: true, name: true, businessUnitId: true } as const;
  const [businessUnits, offices, customerGroups, priceLists, customers, categories, items] = await Promise.all([
    db().businessUnit.findMany({ where: unitScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db().office.findMany({ where: unit, orderBy: { name: "asc" }, select: bu }),
    db().customerGroup.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: bu }),
    db().priceList.findMany({ where: unit, orderBy: { name: "asc" }, select: bu }),
    db().customer.findMany({ where: { ...unit, isActive: true }, orderBy: { name: "asc" }, select: { ...bu, code: true } }),
    db().itemCategory.findMany({ where: unit, orderBy: [{ level: "asc" }, { name: "asc" }], select: { ...bu, parentId: true, level: true } }),
    db().item.findMany({
      where: { ...unit, isActive: true },
      orderBy: { name: "asc" },
      select: { ...bu, code: true, uom: true, itemType: true, categoryId: true, salesRate: true },
    }),
  ]);
  return {
    businessUnits,
    offices,
    customerGroups,
    priceLists,
    customers,
    categories,
    items: items.map((item) => ({ ...item, salesRate: item.salesRate.toString() })),
  };
}
