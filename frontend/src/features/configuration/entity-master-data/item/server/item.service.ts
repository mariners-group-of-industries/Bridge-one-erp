import { formatNumber, nextNumber } from "@/features/sales/lib/sequence";
import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, inUse, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import {
  createCategorySchema,
  createNamedOptionSchema,
  itemInputSchema,
  openingStockSchema,
  updateCategorySchema,
  type CategoryOption,
  type CreateCategoryInput,
  type CreateNamedOptionInput,
  type GlAccountOption,
  type ItemData,
  type ItemDto,
  type ItemFormOptions,
  type ItemInput,
  type ItemList,
  type ItemListQuery,
  type ItemListRow,
  type OpeningStockInput,
  type OpeningStockOptions,
  type OpeningStockResult,
  type UpdateCategoryInput,
} from "../schemas/item.schema";

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof db>;

// ─── Scoping ──────────────────────────────────────────────────────────────────

function unitScope(actor: Actor): Prisma.BusinessUnitWhereInput {
  return actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };
}

function itemScope(actor: Actor): Prisma.ItemWhereInput {
  return { businessUnit: unitScope(actor) };
}

async function loadUnit(actor: Actor, businessUnitId: string, client: Client = db()) {
  const unit = await client.businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true, companyId: true } });
  if (!unit) throw notFound("Business unit");
  assertCompanyAccess(actor, unit.companyId, "Business unit");
  return unit;
}

async function loadItem(actor: Actor, id: string, client: Client = db()) {
  const item = await client.item.findFirst({ where: { id, ...itemScope(actor) } });
  if (!item) throw notFound("Item");
  return item;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

const orNull = (value: string) => (value === "" ? null : value);
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const decimalText = (value: Prisma.Decimal | null | undefined) => (value === null || value === undefined ? null : value.toString());
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Category chain of an item, deepest first → [category, sub, minor] by level. */
const categoryChainSelect = {
  id: true,
  name: true,
  level: true,
  parent: { select: { id: true, name: true, level: true, parent: { select: { id: true, name: true, level: true } } } },
} satisfies Prisma.ItemCategorySelect;

type ChainRecord = Prisma.ItemCategoryGetPayload<{ select: typeof categoryChainSelect }>;

function chainByLevel(category: ChainRecord | null) {
  const levels: Record<number, { id: string; name: string }> = {};
  let node: { id: string; name: string; level: number; parent?: unknown } | null | undefined = category;
  while (node) {
    levels[node.level] = { id: node.id, name: node.name };
    node = (node as { parent?: typeof node }).parent ?? null;
  }
  return levels;
}

function columns(data: ItemData) {
  return {
    code: data.code,
    name: data.name,
    printedCode: data.printedCode,
    printedName: data.printedName,
    itemType: orNull(data.itemType),
    uom: data.uom,
    divisionId: orNull(data.divisionId),
    categoryId: orNull(data.minorCategoryId || data.subCategoryId || data.categoryId),
    altUom: orNull(data.altUom),
    altUomFactor: orNull(data.altUnit),
    netWeight: orNull(data.netWeight),
    netWeightUnit: orNull(data.netWeightUnit),
    restrictedAge: orNull(data.restrictedAge),
    tracking: data.tracking,
    barcode: orNull(data.barcode),
    brand: orNull(data.brand),
    salesRate: data.sellingPrice || "0",
    mrp: orNull(data.retailPrice),
    dealerPrice: orNull(data.dealerPrice),
    tradingPrice: orNull(data.tradingPrice),
    purchasePrice: orNull(data.purchasePrice),
    vatPercent: data.vatPercent || "0",
    autoBarcode: data.autoBarcode,
    canBeSold: data.canBeSold,
    canBePurchased: data.canBePurchased,
    canBeProduced: data.canBeProduced,
    canBeRented: data.canBeRented,
    noDecimal: data.noDecimal,
    allowEbt: data.allowEbt,
    isDefault: data.isDefault,
  };
}

const itemInclude = { category: { select: categoryChainSelect } } satisfies Prisma.ItemInclude;
type ItemRecord = Prisma.ItemGetPayload<{ include: typeof itemInclude }>;

function toDto(record: ItemRecord): ItemDto {
  const chain = chainByLevel(record.category);
  return {
    id: record.id,
    isActive: record.isActive,
    businessUnitId: record.businessUnitId,
    autoBarcode: record.autoBarcode,
    canBeSold: record.canBeSold,
    canBePurchased: record.canBePurchased,
    canBeProduced: record.canBeProduced,
    canBeRented: record.canBeRented,
    noDecimal: record.noDecimal,
    allowEbt: record.allowEbt,
    isDefault: record.isDefault,
    code: record.code,
    printedCode: str(record.printedCode),
    name: record.name,
    printedName: str(record.printedName),
    itemType: (record.itemType ?? "") as ItemDto["itemType"],
    uom: record.uom,
    divisionId: str(record.divisionId),
    categoryId: chain[1]?.id ?? "",
    subCategoryId: chain[2]?.id ?? "",
    minorCategoryId: chain[3]?.id ?? "",
    altUom: str(record.altUom),
    altUnit: str(record.altUomFactor),
    netWeight: str(record.netWeight),
    netWeightUnit: str(record.netWeightUnit),
    restrictedAge: (record.restrictedAge ?? "") as ItemDto["restrictedAge"],
    tracking: record.tracking === "BATCH" ? "BATCH" : "NONE",
    barcode: str(record.barcode),
    brand: str(record.brand),
    sellingPrice: record.salesRate.toString(),
    retailPrice: str(record.mrp),
    dealerPrice: str(record.dealerPrice),
    tradingPrice: str(record.tradingPrice),
    purchasePrice: str(record.purchasePrice),
    vatPercent: record.vatPercent.toString(),
  };
}

/** The chosen division and category chain must belong to the item's business unit. */
async function validateReferences(tx: Tx, businessUnitId: string, data: ItemData) {
  if (data.divisionId) {
    const division = await tx.itemDivision.findUnique({ where: { id: data.divisionId } });
    if (!division || division.businessUnitId !== businessUnitId) throw badRequest("Select a division of this business unit.");
  }
  const checkLevel = async (id: string, level: number, parentId: string | null, label: string) => {
    if (!id) return;
    const category = await tx.itemCategory.findUnique({ where: { id } });
    if (!category || category.businessUnitId !== businessUnitId || category.level !== level || (category.parentId ?? null) !== parentId) {
      throw badRequest(`Select a valid ${label}.`);
    }
  };
  await checkLevel(data.categoryId, 1, null, "category");
  await checkLevel(data.subCategoryId, 2, data.categoryId || null, "sub category of the selected category");
  await checkLevel(data.minorCategoryId, 3, data.subCategoryId || null, "minor category of the selected sub category");
}

/** EAN-13 in the in-store range (prefix 20) with a check digit. */
async function generateBarcode(tx: Tx, businessUnitId: string): Promise<string> {
  const serial = await nextNumber(tx, businessUnitId, "ITEM_BARCODE", 0);
  const body = `20${String(serial).padStart(10, "0")}`;
  const sum = [...body].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

async function assertCodeFree(tx: Tx, businessUnitId: string, code: string, exceptId?: string) {
  const existing = await tx.item.findUnique({ where: { businessUnitId_code: { businessUnitId, code } } });
  if (existing && existing.id !== exceptId) throw conflict(`Item code "${code}" is already used in this business unit.`);
}

// ─── Items ────────────────────────────────────────────────────────────────────

/** Current stock, last cost and average cost from opening stock receipts. */
async function stockFigures(itemIds: string[]) {
  if (itemIds.length === 0) return new Map<string, { stock: Prisma.Decimal; amount: Prisma.Decimal; last: Prisma.Decimal | null }>();
  const [sums, latest] = await Promise.all([
    db().openingStockLine.groupBy({ by: ["itemId"], where: { itemId: { in: itemIds } }, _sum: { quantity: true, amount: true } }),
    db().openingStockLine.findMany({
      where: { itemId: { in: itemIds } },
      orderBy: [{ itemId: "asc" }, { receipt: { receiptDate: "desc" } }, { receipt: { createdAt: "desc" } }, { sortOrder: "desc" }],
      distinct: ["itemId"],
      select: { itemId: true, rate: true },
    }),
  ]);
  const lastRate = new Map(latest.map((line) => [line.itemId, line.rate]));
  return new Map(
    sums.map((sum) => [
      sum.itemId,
      { stock: sum._sum.quantity ?? new Prisma.Decimal(0), amount: sum._sum.amount ?? new Prisma.Decimal(0), last: lastRate.get(sum.itemId) ?? null },
    ]),
  );
}

export async function listItems(actor: Actor, query: ItemListQuery): Promise<ItemList> {
  const search = query.search ? { contains: escapeLike(query.search), mode: "insensitive" as const } : undefined;
  const where: Prisma.ItemWhereInput = {
    AND: [
      itemScope(actor),
      search
        ? { OR: [{ code: search }, { name: search }, { printedCode: search }, { printedName: search }, { barcode: search }, { brand: search }] }
        : {},
    ],
  };
  const [total, records] = await Promise.all([
    db().item.count({ where }),
    db().item.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { code: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { category: { select: categoryChainSelect }, division: { select: { name: true } } },
    }),
  ]);
  const stock = await stockFigures(records.map((record) => record.id));

  const rows: ItemListRow[] = records.map((record) => {
    const chain = chainByLevel(record.category);
    const figures = stock.get(record.id);
    const average = figures && !figures.stock.isZero() ? figures.amount.div(figures.stock).toDecimalPlaces(2) : null;
    return {
      id: record.id,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      code: record.code,
      barcode: record.barcode,
      printedCode: record.printedCode,
      name: record.name,
      itemType: record.itemType,
      divisionName: record.division?.name ?? null,
      categoryName: chain[1]?.name ?? null,
      subCategoryName: chain[2]?.name ?? null,
      minorCategoryName: chain[3]?.name ?? null,
      brand: record.brand,
      uom: record.uom,
      netWeightUnit: record.netWeightUnit,
      currentStock: figures ? figures.stock.toString() : "0",
      sellingPrice: record.salesRate.toString(),
      retailPrice: decimalText(record.mrp),
      dealerPrice: decimalText(record.dealerPrice),
      tradingPrice: decimalText(record.tradingPrice),
      purchasePrice: decimalText(record.purchasePrice),
      lastCost: decimalText(figures?.last),
      avgCost: decimalText(average),
      vatPercent: record.vatPercent.toString(),
    };
  });
  return { rows, total, page: query.page, pageSize: query.pageSize };
}

export async function getItem(actor: Actor, id: string): Promise<ItemDto> {
  const item = await db().item.findFirst({ where: { id, ...itemScope(actor) }, include: itemInclude });
  if (!item) throw notFound("Item");
  return toDto(item);
}

export async function createItem(actor: Actor, input: ItemInput): Promise<ItemDto> {
  const data = itemInputSchema.parse(input);
  await loadUnit(actor, data.businessUnitId);
  const record = await db().$transaction(async (tx) => {
    await validateReferences(tx, data.businessUnitId, data);
    await assertCodeFree(tx, data.businessUnitId, data.code);
    const barcode = data.barcode || (data.autoBarcode ? await generateBarcode(tx, data.businessUnitId) : "");
    return tx.item.create({
      data: { ...columns({ ...data, barcode }), businessUnitId: data.businessUnitId },
      include: itemInclude,
    });
  });
  return toDto(record);
}

export async function updateItem(actor: Actor, id: string, input: ItemInput): Promise<ItemDto> {
  const data = itemInputSchema.parse(input);
  const existing = await loadItem(actor, id);
  if (data.businessUnitId !== existing.businessUnitId) throw badRequest("An item cannot move to another business unit.");
  const record = await db().$transaction(async (tx) => {
    await validateReferences(tx, existing.businessUnitId, data);
    if (data.code !== existing.code) await assertCodeFree(tx, existing.businessUnitId, data.code, id);
    const barcode = data.barcode || (data.autoBarcode ? await generateBarcode(tx, existing.businessUnitId) : "");
    return tx.item.update({ where: { id }, data: columns({ ...data, barcode }), include: itemInclude });
  });
  return toDto(record);
}

export async function setItemActive(actor: Actor, id: string, isActive: boolean) {
  await loadItem(actor, id);
  return db().item.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
}

// ─── Form options, categories, divisions, units ───────────────────────────────

export async function getFormOptions(actor: Actor): Promise<ItemFormOptions> {
  const unit = { businessUnit: unitScope(actor) };
  const [businessUnits, divisions, categories, uoms, usedUoms] = await Promise.all([
    db().businessUnit.findMany({ where: unitScope(actor), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db().itemDivision.findMany({ where: unit, orderBy: { name: "asc" }, select: { id: true, name: true, businessUnitId: true } }),
    db().itemCategory.findMany({
      where: unit,
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parentId: true, level: true, businessUnitId: true, description: true, _count: { select: { items: true } } },
    }),
    db().itemUom.findMany({ where: unit, select: { name: true, businessUnitId: true } }),
    db().item.findMany({ where: unit, distinct: ["businessUnitId", "uom"], select: { uom: true, businessUnitId: true } }),
  ]);
  // Units added here plus the units existing items already use.
  const seen = new Set<string>();
  const allUoms = [...uoms, ...usedUoms.map((row) => ({ name: row.uom, businessUnitId: row.businessUnitId }))]
    .filter((row) => {
      const key = `${row.businessUnitId}|${row.name.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    businessUnits,
    divisions,
    categories: categories.map(({ _count, ...category }): CategoryOption => ({ ...category, itemCount: _count.items })),
    uoms: allUoms,
  };
}

export async function createCategory(actor: Actor, input: CreateCategoryInput): Promise<CategoryOption> {
  const data = createCategorySchema.parse(input);
  await loadUnit(actor, data.businessUnitId);
  let level = 1;
  if (data.parentId) {
    const parent = await db().itemCategory.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.businessUnitId !== data.businessUnitId) throw badRequest("Select a valid parent category.");
    if (parent.level >= 3) throw badRequest("Minor categories cannot have children.");
    level = parent.level + 1;
  }
  const duplicate = await db().itemCategory.findFirst({
    where: { businessUnitId: data.businessUnitId, parentId: data.parentId || null, name: { equals: data.name, mode: "insensitive" } },
  });
  if (duplicate) throw conflict(`"${data.name}" already exists here.`);
  const created = await db().itemCategory.create({
    data: { businessUnitId: data.businessUnitId, parentId: data.parentId || null, level, name: data.name, description: orNull(data.description) },
    select: { id: true, name: true, parentId: true, level: true, businessUnitId: true, description: true },
  });
  return { ...created, itemCount: 0 };
}

async function loadCategory(actor: Actor, id: string) {
  const category = await db().itemCategory.findFirst({ where: { id, businessUnit: unitScope(actor) } });
  if (!category) throw notFound("Category");
  return category;
}

export async function updateCategory(actor: Actor, id: string, input: UpdateCategoryInput) {
  const data = updateCategorySchema.parse(input);
  const category = await loadCategory(actor, id);
  const duplicate = await db().itemCategory.findFirst({
    where: { businessUnitId: category.businessUnitId, parentId: category.parentId, name: { equals: data.name, mode: "insensitive" }, id: { not: id } },
  });
  if (duplicate) throw conflict(`"${data.name}" already exists here.`);
  return db().itemCategory.update({
    where: { id },
    data: { name: data.name, description: orNull(data.description) },
    select: { id: true, name: true, description: true },
  });
}

export async function deleteCategory(actor: Actor, id: string): Promise<void> {
  const category = await loadCategory(actor, id);
  const [children, items] = await Promise.all([
    db().itemCategory.count({ where: { parentId: category.id } }),
    db().item.count({ where: { categoryId: category.id } }),
  ]);
  if (children > 0) throw inUse("Delete or move its sub categories first.");
  if (items > 0) throw inUse(`${items} item${items === 1 ? " uses" : "s use"} this category.`);
  await db().itemCategory.delete({ where: { id } });
}

export async function createDivision(actor: Actor, input: CreateNamedOptionInput) {
  const data = createNamedOptionSchema.parse(input);
  await loadUnit(actor, data.businessUnitId);
  const duplicate = await db().itemDivision.findFirst({ where: { businessUnitId: data.businessUnitId, name: { equals: data.name, mode: "insensitive" } } });
  if (duplicate) throw conflict(`"${data.name}" already exists.`);
  return db().itemDivision.create({ data: { businessUnitId: data.businessUnitId, name: data.name }, select: { id: true, name: true, businessUnitId: true } });
}

export async function createUom(actor: Actor, input: CreateNamedOptionInput) {
  const data = createNamedOptionSchema.parse(input);
  if (data.name.length > 20) throw badRequest("Units must be 20 characters or fewer.");
  await loadUnit(actor, data.businessUnitId);
  const duplicate = await db().itemUom.findFirst({ where: { businessUnitId: data.businessUnitId, name: { equals: data.name, mode: "insensitive" } } });
  if (duplicate) return { name: duplicate.name, businessUnitId: duplicate.businessUnitId };
  return db().itemUom.create({ data: { businessUnitId: data.businessUnitId, name: data.name }, select: { name: true, businessUnitId: true } });
}

// ─── Opening stock ────────────────────────────────────────────────────────────

/**
 * Posting (non-group) accounts from the chart of accounts table. That table comes
 * from the accounting work on another branch, so it may not exist yet.
 */
export async function listGlAccounts(): Promise<GlAccountOption[]> {
  const [{ exists }] = await db().$queryRaw<{ exists: boolean }[]>`SELECT to_regclass('public.accounts') IS NOT NULL AS "exists"`;
  if (!exists) return [];
  const rows = await db().$queryRaw<{ code: string; name: string; type: string | null }[]>`
    SELECT code, name, "accountType" AS type FROM accounts
    WHERE COALESCE("isGroup", false) = false AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
    ORDER BY "accountType", code`;
  return rows.map((row) => ({ code: row.code, name: row.name, type: row.type ?? "OTHER" }));
}

const isAsset = (itemType: string | null) => itemType === "Asset";
const isInventory = (itemType: string | null) => itemType !== "Asset" && itemType !== "Service";

export async function getOpeningStockOptions(actor: Actor): Promise<OpeningStockOptions> {
  const unit = { businessUnit: unitScope(actor) };
  const [offices, warehouses, items, accounts] = await Promise.all([
    db().office.findMany({ where: unit, orderBy: { name: "asc" }, select: { id: true, name: true, businessUnitId: true } }),
    db().warehouse.findMany({ where: { office: unit }, orderBy: { name: "asc" }, select: { id: true, name: true, officeId: true } }),
    db().item.findMany({
      where: { ...unit, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, uom: true, itemType: true, noDecimal: true, businessUnitId: true },
    }),
    listGlAccounts(),
  ]);
  return { offices, warehouses, items, accounts };
}

export async function createOpeningStock(actor: Actor, input: OpeningStockInput): Promise<OpeningStockResult> {
  const data = openingStockSchema.parse(input);
  const office = await db().office.findUnique({
    where: { id: data.officeId },
    select: { id: true, businessUnitId: true, businessUnit: { select: { companyId: true } } },
  });
  if (!office) throw notFound("Office");
  assertCompanyAccess(actor, office.businessUnit.companyId, "Office");
  const warehouse = await db().warehouse.findUnique({ where: { id: data.warehouseId } });
  if (!warehouse || warehouse.officeId !== office.id) throw badRequest("Select a warehouse of the selected office.");

  const items = await db().item.findMany({ where: { id: { in: data.lines.map((line) => line.itemId) } } });
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const [index, line] of data.lines.entries()) {
    const item = byId.get(line.itemId);
    const where = `Row ${index + 1}`;
    if (!item || item.businessUnitId !== office.businessUnitId) throw badRequest(`${where}: select an item of this business unit.`);
    if (data.itemType === "ASSET" ? !isAsset(item.itemType) : !isInventory(item.itemType)) {
      throw badRequest(`${where}: ${item.name} is not ${data.itemType === "ASSET" ? "an asset" : "an inventory"} item.`);
    }
    if (item.noDecimal && !Number.isInteger(Number(line.quantity))) throw badRequest(`${where}: ${item.name} only allows whole quantities.`);
  }

  let account: GlAccountOption | undefined;
  if (data.creditAccountCode) {
    account = (await listGlAccounts()).find((option) => option.code === data.creditAccountCode);
    if (!account) throw badRequest("Select a valid credit GL account.");
  }

  const lines = data.lines.map((line, index) => {
    const quantity = new Prisma.Decimal(line.quantity);
    const rate = new Prisma.Decimal(line.rate);
    return { sortOrder: index, itemId: line.itemId, quantity, rate, amount: quantity.mul(rate).toDecimalPlaces(2) };
  });
  const year = Number(data.receiptDate.slice(0, 4));

  const receipt = await db().$transaction(async (tx) => {
    const number = formatNumber("OS", year, await nextNumber(tx, office.businessUnitId, "OPENING_STOCK", year));
    return tx.openingStockReceipt.create({
      data: {
        businessUnitId: office.businessUnitId,
        number,
        receiptDate: new Date(`${data.receiptDate}T00:00:00.000Z`),
        officeId: office.id,
        warehouseId: warehouse.id,
        itemType: data.itemType,
        challanNo: orNull(data.challanNo),
        remarks: orNull(data.remarks),
        creditAccountCode: account?.code ?? null,
        creditAccountName: account?.name ?? null,
        lines: { create: lines },
      },
      select: { id: true, number: true },
    });
  });
  const total = lines.reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0));
  return { id: receipt.id, number: receipt.number, lineCount: lines.length, totalAmount: total.toFixed(2) };
}
