import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, inUse, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { userNames } from "@/features/sales/lib/users";
import { targetBusinessUnit } from "../../lib/business-unit";
import { altQty, bomTotals, materialAmount, overheadAmount, outputWeight, round4, totalQty, wastageQty } from "../lib/bom-totals";
import {
  bomChildrenSchema,
  bomDeleteSchema,
  bomInputSchema,
  bomListQuerySchema,
  bomOptionsQuerySchema,
  bomStatusSchema,
  bomUpdateSchema,
  type BomDetail,
  type BomItemOption,
  type BomLookups,
  type BomOption,
  type BomRow,
  type ParsedBomInput,
} from "../schemas/bom.schema";

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof db>;

/** Rows a list returns. */
export const BOM_LIST_LIMIT = 1000;

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const optNum = (value: Prisma.Decimal | null | undefined) => (value === null || value === undefined ? null : value.toNumber());
/** Accounts an overhead may be booked to. */
const OVERHEAD_ACCOUNT = { accountType: "EXPENSE", isGroup: false, status: "ACTIVE" } as const;
const STALE = "Someone else changed this bill of material. Reload and try again.";

const ITEM_SELECT = { code: true, name: true, uom: true, altUom: true } as const;

const ROW_INCLUDE = {
  department: { select: { name: true } },
  departmentSection: { select: { name: true } },
  outputs: { select: { itemId: true, lotSizeQty: true, item: { select: ITEM_SELECT } }, orderBy: { lineNo: "asc" } },
  _count: { select: { children: true } },
} satisfies Prisma.ProductionBomInclude;

type RowRecord = Prisma.ProductionBomGetPayload<{ include: typeof ROW_INCLUDE }>;

function toRow(record: RowRecord, nameOf: (id: string) => string | null): BomRow {
  return {
    id: record.id,
    businessUnitId: record.businessUnitId,
    name: record.name,
    bomType: record.bomType,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    departmentName: record.department?.name ?? null,
    sectionName: record.departmentSection?.name ?? null,
    outputs: record.outputs.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      uom: line.item.uom,
      altUom: line.item.altUom,
      lotSizeQty: num(line.lotSizeQty),
    })),
    lotSize: num(record.lotSize),
    tolerancePercent: optNum(record.tolerancePercent),
    materialCost: num(record.materialCost),
    overheadCost: num(record.overheadCost),
    totalCost: num(record.totalCost),
    isActive: record.isActive,
    childCount: record._count.children,
    createdByName: nameOf(record.createdBy) ?? record.createdBy,
  };
}

export async function listBoms(actor: Actor, raw: unknown): Promise<BomRow[]> {
  const query = bomListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const search = query.search ? { contains: query.search, mode: "insensitive" as const } : undefined;
  const records = await db().productionBom.findMany({
    where: {
      businessUnitId: { in: unitIds },
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.departmentSectionId ? { departmentSectionId: query.departmentSectionId } : {}),
      ...(query.status ? { isActive: query.status === "ACTIVE" } : {}),
      ...(search
        ? { OR: [{ name: search }, { outputs: { some: { item: { OR: [{ name: search }, { code: search }] } } } }] }
        : {}),
    },
    include: ROW_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: BOM_LIST_LIMIT,
  });
  const nameOf = await userNames(records.map((record) => record.createdBy));
  return records.map((record) => toRow(record, nameOf));
}

async function findInScope(actor: Actor, id: string, client: Client = db()) {
  const unitIds = await scopedBusinessUnitIds(actor);
  const record = await client.productionBom.findFirst({
    where: { id, businessUnitId: { in: unitIds } },
    include: {
      ...ROW_INCLUDE,
      outputs: { include: { item: { select: ITEM_SELECT } }, orderBy: { lineNo: "asc" } },
      materials: { include: { item: { select: ITEM_SELECT } }, orderBy: { lineNo: "asc" } },
      wastages: { include: { item: { select: ITEM_SELECT } }, orderBy: { lineNo: "asc" } },
      overheads: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } },
      children: { include: { child: { select: { name: true, totalCost: true, isActive: true } } }, orderBy: { createdAt: "asc" } },
      parents: { include: { parent: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!record) throw notFound("Bill of material");
  return record;
}

export async function getBom(actor: Actor, id: string): Promise<BomDetail> {
  const record = await findInScope(actor, id);
  const nameOf = await userNames([record.createdBy]);
  const base = {
    outputWeight: round4(record.outputs.reduce((sum, line) => sum + num(line.totalWeight), 0)),
    materialTotalQty: round4(record.materials.reduce((sum, line) => sum + num(line.totalQty), 0)),
  };
  return {
    ...toRow(record, nameOf),
    departmentId: record.departmentId,
    departmentSectionId: record.departmentSectionId,
    remarks: record.remarks,
    outputLines: record.outputs.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      uom: line.item.uom,
      outputType: line.outputType,
      netWeight: num(line.netWeight),
      lotSizeQty: num(line.lotSizeQty),
      totalWeight: num(line.totalWeight),
      costPercent: num(line.costPercent),
    })),
    materials: record.materials.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      materialType: line.materialType,
      excludeFromScrap: line.excludeFromScrap,
      uom: line.uom,
      altUom: line.altUom,
      altQty: optNum(line.altQty),
      qty: num(line.qty),
      wastagePercent: num(line.wastagePercent),
      totalQty: num(line.totalQty),
      rate: num(line.rate),
      amount: num(line.amount),
    })),
    wastages: record.wastages.map((line) => ({
      itemId: line.itemId,
      code: line.item.code,
      name: line.item.name,
      uom: line.uom,
      itemType: line.itemType,
      outputType: line.outputType,
      ratioPercent: num(line.ratioPercent),
      isMandatory: line.isMandatory,
      calcWithNetWeight: line.calcWithNetWeight,
      calcWithProcessRunner: line.calcWithProcessRunner,
      expectedQty: wastageQty(num(line.ratioPercent), line.calcWithNetWeight, base),
    })),
    overheads: record.overheads.map((line) => ({
      accountId: line.accountId,
      accountCode: line.account.code,
      accountName: line.account.name,
      percentage: optNum(line.percentage),
      amount: num(line.amount),
    })),
    children: record.children.map((link) => ({
      childBomId: link.childBomId,
      name: link.child.name,
      stage: link.stage,
      totalCost: num(link.child.totalCost),
      isActive: link.child.isActive,
    })),
    parents: record.parents.map((link) => ({ id: link.parent.id, name: link.parent.name, stage: link.stage })),
  };
}

/** Lines with their stored values, after checking every item and the department belong to the business unit. */
async function prepare(tx: Tx, businessUnitId: string, input: ParsedBomInput) {
  const itemIds = [...new Set([...input.outputs, ...input.materials, ...input.wastages].map((line) => line.itemId))];
  const accountIds = input.overheads.map((line) => line.accountId);
  const [items, department, section, accounts] = await Promise.all([
    tx.item.findMany({ where: { id: { in: itemIds }, businessUnitId }, select: { id: true, uom: true, altUom: true, altUomFactor: true, itemType: true } }),
    input.departmentId ? tx.productionDepartment.findFirst({ where: { id: input.departmentId, businessUnitId }, select: { id: true } }) : null,
    input.departmentSectionId ? tx.productionDepartmentSection.findFirst({ where: { id: input.departmentSectionId }, select: { departmentId: true } }) : null,
    accountIds.length ? tx.account.findMany({ where: { id: { in: accountIds }, ...OVERHEAD_ACCOUNT }, select: { id: true } }) : [],
  ]);
  if (accounts.length !== accountIds.length) throw badRequest("Overheads must be booked to an active expense account.");
  if (items.length !== itemIds.length) throw badRequest("An item is not part of this business unit.");
  if (input.departmentId && !department) throw badRequest("Choose a department of this business unit.");
  if (input.departmentSectionId && section?.departmentId !== input.departmentId) {
    throw badRequest("The section does not belong to the chosen department.");
  }
  const itemById = new Map(items.map((item) => [item.id, item]));
  const totals = bomTotals(input.materials, input.overheads, input.outputs);
  return {
    header: {
      name: input.name,
      bomType: input.bomType,
      departmentId: input.departmentId ?? null,
      departmentSectionId: input.departmentSectionId ?? null,
      tolerancePercent: input.tolerancePercent ?? null,
      remarks: input.remarks || null,
      lotSize: totals.lotSize,
      materialCost: totals.materialCost,
      overheadCost: totals.overheadCost,
      totalCost: totals.totalCost,
    },
    outputs: input.outputs.map((line, index) => ({
      lineNo: index + 1,
      itemId: line.itemId,
      outputType: line.outputType,
      netWeight: line.netWeight,
      lotSizeQty: line.lotSizeQty,
      totalWeight: outputWeight(line.netWeight, line.lotSizeQty),
      costPercent: line.costPercent,
    })),
    materials: input.materials.map((line, index) => {
      const item = itemById.get(line.itemId)!;
      return {
        lineNo: index + 1,
        itemId: line.itemId,
        materialType: line.materialType || item.itemType || null,
        excludeFromScrap: line.excludeFromScrap,
        uom: item.uom,
        altUom: item.altUom,
        altQty: item.altUom ? altQty(line.qty, num(item.altUomFactor)) : null,
        qty: line.qty,
        wastagePercent: line.wastagePercent,
        totalQty: totalQty(line.qty, line.wastagePercent),
        rate: line.rate,
        amount: materialAmount(line.qty, line.wastagePercent, line.rate),
      };
    }),
    wastages: input.wastages.map((line, index) => {
      const item = itemById.get(line.itemId)!;
      return {
        lineNo: index + 1,
        itemId: line.itemId,
        itemType: line.itemType || item.itemType || null,
        uom: item.uom,
        outputType: line.outputType,
        ratioPercent: line.ratioPercent,
        isMandatory: line.isMandatory,
        calcWithNetWeight: line.calcWithNetWeight,
        calcWithProcessRunner: line.calcWithProcessRunner,
      };
    }),
    overheads: input.overheads.map((line, index) => ({
      lineNo: index + 1,
      accountId: line.accountId,
      percentage: line.percentage ?? null,
      amount: overheadAmount(totals.materialCost, line.percentage, line.amount),
    })),
  };
}

/** Serialises saves of BOM names and child links in one business unit. */
async function lockUnit(tx: Tx, businessUnitId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bom:${businessUnitId}`}))`;
}

async function assertNameFree(tx: Tx, businessUnitId: string, name: string, exceptId?: string) {
  const taken = await tx.productionBom.findFirst({
    where: { businessUnitId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw conflict(`A bill of material named ${name} already exists.`);
}

export async function createBom(actor: Actor, raw: unknown): Promise<BomDetail> {
  const input = bomInputSchema.parse(raw);
  const businessUnitId = await targetBusinessUnit(actor, input.businessUnitId);
  const id = await db().$transaction(async (tx) => {
    await lockUnit(tx, businessUnitId);
    await assertNameFree(tx, businessUnitId, input.name);
    const lines = await prepare(tx, businessUnitId, input);
    const created = await tx.productionBom.create({
      data: {
        businessUnitId,
        ...lines.header,
        createdBy: actor.id,
        outputs: { create: lines.outputs },
        materials: { create: lines.materials },
        wastages: { create: lines.wastages },
        overheads: { create: lines.overheads },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getBom(actor, id);
}

export async function updateBom(actor: Actor, id: string, raw: unknown): Promise<BomDetail> {
  const { version, data } = bomUpdateSchema.parse(raw);
  const current = await findInScope(actor, id);
  await db().$transaction(async (tx) => {
    await lockUnit(tx, current.businessUnitId);
    await assertNameFree(tx, current.businessUnitId, data.name, id);
    const lines = await prepare(tx, current.businessUnitId, data);
    const { count } = await tx.productionBom.updateMany({ where: { id, updatedAt: new Date(version) }, data: lines.header });
    if (count === 0) throw conflict(STALE);
    await Promise.all([
      tx.productionBomOutput.deleteMany({ where: { bomId: id } }),
      tx.productionBomMaterial.deleteMany({ where: { bomId: id } }),
      tx.productionBomWastage.deleteMany({ where: { bomId: id } }),
      tx.productionBomOverhead.deleteMany({ where: { bomId: id } }),
    ]);
    const withBom = <T>(rows: T[]) => rows.map((row) => ({ ...row, bomId: id }));
    await tx.productionBomOutput.createMany({ data: withBom(lines.outputs) });
    await tx.productionBomMaterial.createMany({ data: withBom(lines.materials) });
    if (lines.wastages.length) await tx.productionBomWastage.createMany({ data: withBom(lines.wastages) });
    if (lines.overheads.length) await tx.productionBomOverhead.createMany({ data: withBom(lines.overheads) });
  });
  return getBom(actor, id);
}

/** Active / inactive toggle of the list. */
export async function setBomActive(actor: Actor, id: string, raw: unknown): Promise<BomRow> {
  const { version, isActive } = bomStatusSchema.parse(raw);
  await findInScope(actor, id);
  const { count } = await db().productionBom.updateMany({ where: { id, updatedAt: new Date(version) }, data: { isActive } });
  if (count === 0) throw conflict(STALE);
  const record = await findInScope(actor, id);
  return toRow(record, await userNames([record.createdBy]));
}

/** Deletes a BOM that no other BOM uses as a child. Its lines and its own child links go with it. */
export async function deleteBom(actor: Actor, id: string, raw: unknown): Promise<void> {
  const { version } = bomDeleteSchema.parse(raw);
  const current = await findInScope(actor, id);
  await db().$transaction(async (tx) => {
    await lockUnit(tx, current.businessUnitId);
    const parents = await tx.productionBomLink.findMany({ where: { childBomId: id }, select: { parent: { select: { name: true } } } });
    if (parents.length) {
      throw inUse(`This BOM is tagged as a child of ${parents.map((link) => link.parent.name).join(", ")}. Remove it there first.`);
    }
    const { count } = await tx.productionBom.deleteMany({ where: { id, updatedAt: new Date(version) } });
    if (count === 0) throw conflict(STALE);
  });
}

/** Child BOM search for "Tag Child BOM" (active BOMs of the same business unit). */
export async function bomOptions(actor: Actor, raw: unknown): Promise<BomOption[]> {
  const query = bomOptionsQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  let businessUnitIds = unitIds;
  if (query.exclude) businessUnitIds = [(await findInScope(actor, query.exclude)).businessUnitId];
  return db().productionBom.findMany({
    where: {
      businessUnitId: { in: businessUnitIds },
      isActive: true,
      name: { contains: query.search, mode: "insensitive" },
      ...(query.exclude ? { id: { not: query.exclude } } : {}),
    },
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}

/** Replaces the child BOMs of a BOM; refuses links that would make a cycle. */
export async function setBomChildren(actor: Actor, id: string, raw: unknown): Promise<BomDetail> {
  const { links } = bomChildrenSchema.parse(raw);
  const parent = await findInScope(actor, id);
  await db().$transaction(async (tx) => {
    await lockUnit(tx, parent.businessUnitId);
    const childIds = links.map((link) => link.childBomId);
    if (childIds.includes(id)) throw badRequest("A BOM cannot be its own child.");
    const children = await tx.productionBom.findMany({
      where: { id: { in: childIds }, businessUnitId: parent.businessUnitId },
      select: { id: true, name: true },
    });
    if (children.length !== childIds.length) throw badRequest("A child BOM is not part of this business unit.");

    // A child must not already contain this BOM somewhere below it.
    const allLinks = await tx.productionBomLink.findMany({
      where: { parent: { businessUnitId: parent.businessUnitId }, parentBomId: { not: id } },
      select: { parentBomId: true, childBomId: true },
    });
    const below = new Map<string, string[]>();
    for (const link of allLinks) below.set(link.parentBomId, [...(below.get(link.parentBomId) ?? []), link.childBomId]);
    for (const child of children) {
      const seen = new Set<string>();
      const queue = [child.id];
      while (queue.length) {
        const next = queue.shift()!;
        if (next === id) throw badRequest(`${child.name} already uses this BOM below it, so it cannot be its child.`);
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(...(below.get(next) ?? []));
      }
    }

    await tx.productionBomLink.deleteMany({ where: { parentBomId: id } });
    if (links.length) await tx.productionBomLink.createMany({ data: links.map((link) => ({ parentBomId: id, ...link })) });
  });
  return getBom(actor, id);
}

/** Weighted average purchase rate of accepted receipts per item. */
async function receiptRates(unitIds: string[]): Promise<Map<string, number>> {
  if (unitIds.length === 0) return new Map();
  const rows = await db().$queryRaw<{ itemId: string; rate: Prisma.Decimal | null }[]>`
    SELECT l."itemId", SUM(l."acceptedQty" * l."unitPrice") / NULLIF(SUM(l."acceptedQty"), 0) AS rate
    FROM goods_receipt_lines l
    JOIN goods_receipts r ON r.id = l."receiptId"
    WHERE r."businessUnitId" = ANY(${unitIds}::uuid[])
      AND r.status IN ('RECEIVED', 'INSPECTED')
      AND l."itemId" IS NOT NULL
      AND l."acceptedQty" > 0
    GROUP BY l."itemId"`;
  return new Map(rows.map((row) => [row.itemId, Math.round(Number(row.rate ?? 0) * 10_000) / 10_000]));
}

export async function bomLookups(actor: Actor): Promise<BomLookups> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const inUnits = { businessUnitId: { in: unitIds } };
  const [businessUnits, accounts, departments, sections, categories, items, stock, rates] = await Promise.all([
    db().businessUnit.findMany({ where: { id: { in: unitIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().account.findMany({ where: OVERHEAD_ACCOUNT, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    db().productionDepartment.findMany({ where: inUnits, select: { id: true, name: true, businessUnitId: true }, orderBy: { name: "asc" } }),
    db().productionDepartmentSection.findMany({ where: { department: inUnits }, select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } }),
    db().itemCategory.findMany({ where: inUnits, select: { id: true, name: true, parentId: true, level: true, businessUnitId: true }, orderBy: { name: "asc" } }),
    db().item.findMany({
      where: { ...inUnits, isActive: true },
      select: { id: true, businessUnitId: true, code: true, name: true, uom: true, altUom: true, altUomFactor: true, itemType: true, netWeight: true, categoryId: true, purchasePrice: true },
      orderBy: { code: "asc" },
    }),
    db().stockEntry.groupBy({ by: ["itemId"], where: inUnits, _sum: { qty: true } }),
    receiptRates(unitIds),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  /** Level-1 and level-2 ancestors of a category. */
  function ancestors(categoryId: string | null): { categoryId: string | null; subCategoryId: string | null } {
    let level1: string | null = null;
    let level2: string | null = null;
    for (let current = categoryId ? categoryById.get(categoryId) : undefined, depth = 0; current && depth < 10; depth++) {
      if (current.level === 1) level1 = current.id;
      if (current.level === 2) level2 = current.id;
      current = current.parentId ? categoryById.get(current.parentId) : undefined;
    }
    return { categoryId: level1, subCategoryId: level2 };
  }
  const stockById = new Map(stock.map((row) => [row.itemId, num(row._sum.qty)]));
  return {
    businessUnits,
    accounts,
    departments,
    sections,
    categories: categories.filter((category) => category.level <= 2),
    items: items.map(
      (item): BomItemOption => ({
        id: item.id,
        businessUnitId: item.businessUnitId,
        code: item.code,
        name: item.name,
        uom: item.uom,
        altUom: item.altUom,
        altUomFactor: optNum(item.altUomFactor),
        itemType: item.itemType,
        netWeight: optNum(item.netWeight),
        ...ancestors(item.categoryId),
        avgRate: rates.get(item.id) ?? num(item.purchasePrice),
        stock: Math.round((stockById.get(item.id) ?? 0) * 1000) / 1000,
      }),
    ),
  };
}
