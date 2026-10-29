import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { fromDbDate, toDbDate } from "@/features/sales/lib/dates";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { userNames } from "@/features/sales/lib/users";
import { ITEM_TYPES } from "@/features/configuration/entity-master-data/item/schemas/item.schema";
import { round2, round4 } from "../../bom/lib/bom-totals";
import {
  reportLabel,
  reportQuerySchema,
  type ParsedReportQuery,
  type Report,
  type ReportCell,
  type ReportColumn,
  type ReportLookups,
  type ReportType,
} from "../schemas/report.schema";

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const day = (iso: string) => iso.split("-").reverse().join("-");
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : null);
const col = (key: string, label: string, kind: ReportColumn["kind"] = "text"): ReportColumn => ({ key, label, kind });

/** Every day from `from` to `to` ("YYYY-MM-DD"). */
function daysOf(from: string, to: string): string[] {
  const days: string[] = [];
  for (let at = Date.parse(`${from}T00:00:00Z`); at <= Date.parse(`${to}T00:00:00Z`); at += 86_400_000) days.push(new Date(at).toISOString().slice(0, 10));
  return days;
}

/** Sums of the numeric columns `keys` over `rows`, labelled in `labelKey`. */
function totalsOf(rows: Record<string, ReportCell>[], keys: string[], labelKey: string): Record<string, ReportCell> | null {
  if (rows.length === 0) return null;
  const totals: Record<string, ReportCell> = { [labelKey]: "Total" };
  for (const key of keys) totals[key] = round4(rows.reduce((sum, row) => sum + (typeof row[key] === "number" ? (row[key] as number) : 0), 0));
  return totals;
}

// ─── Scope and filters ───────────────────────────────────────────────────────

interface Context {
  query: ParsedReportQuery;
  unitIds: string[];
  /** Item categories allowed by the category / sub category filter (null = any). */
  categoryIds: Set<string> | null;
  company: string;
  subtitle: string[];
}

/** Category ids under the chosen category / sub category / minor category (deepest wins). */
async function categoryScope(unitIds: string[], categoryId?: string, subCategoryId?: string, minorCategoryId?: string): Promise<Set<string> | null> {
  const root = minorCategoryId ?? subCategoryId ?? categoryId;
  if (!root) return null;
  const categories = await db().itemCategory.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, parentId: true } });
  const children = new Map<string, string[]>();
  for (const category of categories) if (category.parentId) children.set(category.parentId, [...(children.get(category.parentId) ?? []), category.id]);
  const scope = new Set<string>();
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    if (scope.has(id)) continue;
    scope.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return scope;
}

async function context(actor: Actor, query: ParsedReportQuery): Promise<Context> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const [categoryIds, unit, office, department, section, workCenter, item] = await Promise.all([
    categoryScope(unitIds, query.categoryId, query.subCategoryId, query.minorCategoryId),
    db().businessUnit.findFirst({ where: { id: { in: unitIds } }, select: { company: { select: { name: true } } }, orderBy: { name: "asc" } }),
    query.officeId ? db().office.findFirst({ where: { id: query.officeId, businessUnitId: { in: unitIds } }, select: { name: true } }) : null,
    query.departmentId ? db().productionDepartment.findFirst({ where: { id: query.departmentId }, select: { name: true } }) : null,
    query.departmentSectionId ? db().productionDepartmentSection.findFirst({ where: { id: query.departmentSectionId }, select: { name: true } }) : null,
    query.workCenterId ? db().productionWorkCenter.findFirst({ where: { id: query.workCenterId }, select: { code: true, name: true } }) : null,
    query.itemId ? db().item.findFirst({ where: { id: query.itemId }, select: { code: true, name: true } }) : null,
  ]);
  const filters = [
    department && `Department: ${department.name}`,
    section && `Section: ${section.name}`,
    workCenter && `Work Center: ${workCenter.code} - ${workCenter.name}`,
    item && `Item: ${item.code} - ${item.name}`,
    query.itemType && `Item Type: ${query.itemType}`,
  ].filter(Boolean) as string[];
  return {
    query,
    unitIds,
    categoryIds,
    company: unit?.company.name ?? "",
    subtitle: [`Office: ${office?.name ?? "All"}`, `From: ${day(query.from)}  To: ${day(query.to)}`, ...(filters.length ? [filters.join(" · ")] : [])],
  };
}

/** Posted entries matching the report filters (item filters apply to the produced item). */
function entryWhere(ctx: Context, applyItemFilters = true): Prisma.ProductionEntryWhereInput {
  const { query } = ctx;
  const itemFilter: Prisma.ProductionEntryWhereInput[] = [];
  if (applyItemFilters) {
    if (query.itemId && query.filterBy !== "category" && query.filterBy !== "bom") itemFilter.push({ itemId: query.itemId });
    if (ctx.categoryIds && query.filterBy !== "item" && query.filterBy !== "bom") itemFilter.push({ item: { categoryId: { in: [...ctx.categoryIds] } } });
    if (query.bomId && query.filterBy === "bom") itemFilter.push({ order: { bomId: query.bomId } });
  }
  return {
    businessUnitId: { in: ctx.unitIds },
    status: "POSTED",
    productionDate: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
    ...(query.officeId ? { officeId: query.officeId } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.departmentSectionId ? { departmentSectionId: query.departmentSectionId } : {}),
    ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
    ...(itemFilter.length ? { AND: itemFilter } : {}),
  };
}

const ENTRY_INCLUDE = {
  item: { select: { code: true, name: true, uom: true } },
  department: { select: { name: true } },
  departmentSection: { select: { name: true } },
  workCenter: { select: { id: true, code: true, name: true, standardRunHour: true, ratedCapacityPerHour: true } },
  order: {
    select: {
      number: true,
      orderDate: true,
      orderQty: true,
      bomLotSize: true,
      unitCost: true,
      bom: { select: { name: true, overheadCost: true, outputs: { select: { itemId: true, costPercent: true, lotSizeQty: true } } } },
    },
  },
} satisfies Prisma.ProductionEntryInclude;

type EntryRecord = Prisma.ProductionEntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

const entries = (ctx: Context, applyItemFilters = true) =>
  db().productionEntry.findMany({ where: entryWhere(ctx, applyItemFilters), include: ENTRY_INCLUDE, orderBy: [{ productionDate: "asc" }, { number: "asc" }] });

const itemLabel = (item: { code: string; name: string }) => `${item.code} - ${item.name}`;
const centerLabel = (entry: EntryRecord) => (entry.workCenter ? `${entry.workCenter.code} - ${entry.workCenter.name}` : "N/A");

// ─── Builders ────────────────────────────────────────────────────────────────

type Built = Pick<Report, "columns" | "rows" | "totals"> & { notes?: string[]; subtitle?: string[] };

async function productionReport(ctx: Context): Promise<Built> {
  const records = await entries(ctx);
  if (ctx.query.summary) {
    const groups = new Map<string, Record<string, ReportCell>>();
    for (const entry of records) {
      const row = groups.get(entry.itemId) ?? { item: itemLabel(entry.item), uom: entry.item.uom, entries: 0, planned: 0, actual: 0, variance: 0, value: 0 };
      row.entries = (row.entries as number) + 1;
      row.planned = round4((row.planned as number) + num(entry.qty));
      row.actual = round4((row.actual as number) + num(entry.netQty));
      row.variance = round4((row.actual as number) - (row.planned as number));
      row.value = round2((row.value as number) + num(entry.netQty) * num(entry.order.unitCost));
      groups.set(entry.itemId, row);
    }
    const rows = [...groups.values()].sort((a, b) => String(a.item).localeCompare(String(b.item)));
    return {
      columns: [col("item", "Produced Item"), col("uom", "UoM"), col("entries", "Entries", "qty"), col("planned", "Planned Qty", "qty"), col("actual", "Actual Qty", "qty"), col("variance", "Variance", "qty"), col("value", "Total Cost / Value", "money")],
      rows,
      totals: totalsOf(rows, ["entries", "planned", "actual", "variance", "value"], "item"),
      notes: ["Planned Qty is the batch's total quantity, Actual Qty the good (net) quantity; Variance = Actual − Planned (rejects).", "Value = net quantity × the order's BOM unit cost."],
    };
  }
  const rows = records.map((entry) => ({
    date: fromDbDate(entry.productionDate),
    order: entry.order.number,
    entry: entry.number,
    item: itemLabel(entry.item),
    section: entry.departmentSection?.name ?? "N/A",
    workCenter: centerLabel(entry),
    shift: entry.shift ?? "N/A",
    planned: num(entry.qty),
    actual: num(entry.netQty),
    variance: round4(num(entry.netQty) - num(entry.qty)),
    uom: entry.item.uom,
    value: round2(num(entry.netQty) * num(entry.order.unitCost)),
  }));
  return {
    columns: [
      col("date", "Date", "date"),
      col("order", "Order Number"),
      col("entry", "Entry Code"),
      col("item", "Produced Item"),
      col("section", "Section"),
      col("workCenter", "Work Center"),
      col("shift", "Shift"),
      col("planned", "Planned Qty", "qty"),
      col("actual", "Actual Qty", "qty"),
      col("variance", "Variance", "qty"),
      col("uom", "UoM"),
      col("value", "Total Cost / Value", "money"),
    ],
    rows,
    totals: totalsOf(rows, ["planned", "actual", "variance", "value"], "date"),
    notes: ["Planned Qty is the batch's total quantity, Actual Qty the good (net) quantity; Variance = Actual − Planned (rejects).", "Value = net quantity × the order's BOM unit cost."],
  };
}

async function consumptionReport(ctx: Context): Promise<Built> {
  const { query } = ctx;
  const materialItem: Prisma.ItemWhereInput = {
    ...(query.itemId && query.filterBy !== "category" ? { id: query.itemId } : {}),
    ...(ctx.categoryIds && query.filterBy !== "item" ? { categoryId: { in: [...ctx.categoryIds] } } : {}),
    ...(query.itemType ? { itemType: query.itemType } : {}),
  };
  const lines = await db().productionEntryMaterial.findMany({
    where: { entry: entryWhere(ctx, false), item: materialItem },
    select: {
      standardQty: true,
      actualQty: true,
      rate: true,
      uom: true,
      itemId: true,
      item: { select: { code: true, name: true, category: { select: { name: true } } } },
      entry: { select: { productionDate: true } },
    },
  });
  const groups = new Map<string, Record<string, ReportCell>>();
  for (const line of lines) {
    const month = fromDbDate(line.entry.productionDate).slice(0, 7);
    const key = query.monthly ? `${month}:${line.itemId}` : line.itemId;
    const row = groups.get(key) ?? {
      ...(query.monthly ? { month } : {}),
      item: itemLabel(line.item),
      category: line.item.category?.name ?? "N/A",
      uom: line.uom,
      standard: 0,
      issued: 0,
      consumed: 0,
      variance: 0,
      variancePct: null,
      standardCost: 0,
      actualCost: 0,
    };
    row.standard = round4((row.standard as number) + num(line.standardQty));
    row.issued = round4((row.issued as number) + num(line.actualQty));
    row.consumed = row.issued;
    row.variance = round4((row.consumed as number) - (row.standard as number));
    row.variancePct = pct(row.variance as number, row.standard as number);
    row.standardCost = round2((row.standardCost as number) + num(line.standardQty) * num(line.rate));
    row.actualCost = round2((row.actualCost as number) + num(line.actualQty) * num(line.rate));
    groups.set(key, row);
  }
  let rows = [...groups.values()].sort((a, b) => `${a.month ?? ""}${a.item}`.localeCompare(`${b.month ?? ""}${b.item}`));
  if (query.materialsVariance) rows = rows.filter((row) => Math.abs(row.variance as number) > 0.00005);
  return {
    columns: [
      ...(query.monthly ? [col("month", "Month")] : []),
      col("item", "Raw Material Item"),
      col("category", "Category"),
      col("uom", "UoM"),
      col("standard", "BOM Standard Qty", "qty"),
      col("issued", "Actual Issued Qty", "qty"),
      col("consumed", "Actual Consumed Qty", "qty"),
      col("variance", "Variance Qty", "qty"),
      col("variancePct", "Variance (%)", "percent"),
      col("standardCost", "Standard Cost", "money"),
      col("actualCost", "Actual Cost", "money"),
    ],
    rows,
    totals: totalsOf(rows, ["standardCost", "actualCost"], query.monthly ? "month" : "item"),
    notes: [
      "Standard Qty is the BOM quantity scaled to each entry's total quantity; materials are issued when consumed, so Issued = Consumed.",
      ...(query.materialsVariance ? ["Only materials with a variance are shown."] : []),
    ],
  };
}

interface HoursGroup {
  label: string;
  shift: string;
  center: EntryRecord["workCenter"];
  dates: Set<string>;
  runHours: number;
  produced: number;
}

async function performanceReport(ctx: Context): Promise<Built> {
  const records = await entries(ctx);
  const byShift = ctx.query.shiftWise;
  const groups = new Map<string, HoursGroup>();
  for (const entry of records) {
    const shift = entry.shift ?? "N/A";
    const key = `${entry.workCenterId ?? "-"}${byShift ? `:${shift}` : ""}`;
    const group = groups.get(key) ?? { label: centerLabel(entry), shift: byShift ? shift : "All", center: entry.workCenter, dates: new Set<string>(), runHours: 0, produced: 0 };
    group.dates.add(fromDbDate(entry.productionDate));
    group.runHours = round2(group.runHours + num(entry.hours));
    group.produced = round4(group.produced + num(entry.qty));
    groups.set(key, group);
  }
  const rows = [...groups.values()]
    .sort((a, b) => `${a.label}${a.shift}`.localeCompare(`${b.label}${b.shift}`))
    .map((group) => {
      // Operating hours come from the work center's standard run hours per production day (not per shift).
      const operating = group.center && !byShift ? round2(group.dates.size * num(group.center.standardRunHour)) : null;
      const downtime = operating === null ? null : round2(Math.max(operating - group.runHours, 0));
      const capacity = group.center ? num(group.center.ratedCapacityPerHour) * group.runHours : 0;
      return {
        workCenter: group.label,
        shift: group.shift,
        operating,
        run: group.runHours,
        downtime,
        produced: group.produced,
        efficiency: pct(group.produced, capacity),
        reason: downtime ? "Not recorded" : "—",
      };
    });
  return {
    columns: [
      col("workCenter", "Work Center / Machine"),
      col("shift", "Shift"),
      col("operating", "Total Operating Hours", "hours"),
      col("run", "Actual Run Hours", "hours"),
      col("downtime", "Downtime Hours", "hours"),
      col("produced", "Produced Qty", "qty"),
      col("efficiency", "Efficiency (%)", "percent"),
      col("reason", "Downtime Reason"),
    ],
    rows,
    totals: totalsOf(rows, ["operating", "run", "downtime", "produced"], "workCenter"),
    notes: [
      "Operating hours = the work center's standard run hours × days with production; shift-wise rows show run hours only.",
      "Efficiency = produced quantity ÷ (rated capacity per hour × run hours). Downtime reasons are not recorded in production entries yet.",
    ],
  };
}

/** One row per batch (production entry), by date, process (section / work center) and item. */
async function processDateReport(ctx: Context): Promise<Built> {
  const records = await entries(ctx);
  const rows = records
    .map((entry) => ({
      date: fromDbDate(entry.productionDate),
      batch: entry.number,
      process: [entry.departmentSection?.name, entry.workCenter ? `${entry.workCenter.code} - ${entry.workCenter.name}` : null].filter(Boolean).join(" / ") || "N/A",
      item: itemLabel(entry.item),
      shift: entry.shift ?? "N/A",
      hours: num(entry.hours),
      batchQty: num(entry.qty),
      wastage: num(entry.rejectQty),
      net: num(entry.netQty),
      uom: entry.item.uom,
      remarks: entry.remarks ?? "",
    }))
    .sort((a, b) => `${a.date}${a.process}${a.item}`.localeCompare(`${b.date}${b.process}${b.item}`));
  return {
    columns: [
      col("date", "Date", "date"),
      col("batch", "Batch No"),
      col("process", "Process / Section"),
      col("item", "Item Name"),
      col("shift", "Shift"),
      col("hours", "Run Hours", "hours"),
      col("batchQty", "Batch Quantity", "qty"),
      col("wastage", "Wastage Qty", "qty"),
      col("net", "Net Good Quantity", "qty"),
      col("uom", "UoM"),
      col("remarks", "Remarks"),
    ],
    rows,
    totals: totalsOf(rows, ["hours", "batchQty", "wastage", "net"], "date"),
    subtitle: [`Office:${ctx.query.officeId ? ctx.subtitle[0].replace("Office: ", "") : "All"}`, reportLabel("process-date"), ctx.subtitle[1], ...ctx.subtitle.slice(2)],
    notes: ["Batch = one production entry; Wastage Qty is the rejected quantity, Net Good Quantity what went to stock."],
  };
}

async function detailsReport(ctx: Context): Promise<Built> {
  const records = await entries(ctx);
  const nameOf = await userNames(records.map((entry) => entry.createdBy));
  const rows = records.map((entry) => ({
    order: entry.order.number,
    orderDate: fromDbDate(entry.order.orderDate),
    item: itemLabel(entry.item),
    bom: entry.order.bom.name,
    lotSize: num(entry.order.bomLotSize),
    orderQty: num(entry.order.orderQty),
    entry: entry.number,
    entryDate: fromDbDate(entry.productionDate),
    shift: entry.shift ?? "N/A",
    total: num(entry.qty),
    reject: num(entry.rejectQty),
    net: num(entry.netQty),
    excess: num(entry.excessQty),
    hours: num(entry.hours),
    createdBy: nameOf(entry.createdBy) ?? "",
  }));
  return {
    columns: [
      col("order", "Order Number"),
      col("orderDate", "Order Date", "date"),
      col("item", "Produced Item"),
      col("bom", "BOM"),
      col("lotSize", "Lot Size", "qty"),
      col("orderQty", "Order Qty", "qty"),
      col("entry", "Entry Code"),
      col("entryDate", "Entry Date", "date"),
      col("shift", "Shift"),
      col("total", "Total Qty", "qty"),
      col("reject", "Reject Qty", "qty"),
      col("net", "Net Qty", "qty"),
      col("excess", "Excess Qty", "qty"),
      col("hours", "Run Hours", "hours"),
      col("createdBy", "Created By"),
    ],
    rows,
    totals: totalsOf(rows, ["total", "reject", "net", "excess", "hours"], "order"),
  };
}

async function detailsViewReport(ctx: Context): Promise<Built> {
  const records = await entries(ctx);
  const groups = new Map<string, Record<string, ReportCell>>();
  const remarks = new Map<string, Set<string>>();
  for (const entry of records) {
    const date = fromDbDate(entry.productionDate);
    const key = `${date}:${entry.departmentSectionId ?? "-"}:${entry.shift ?? "-"}`;
    const row = groups.get(key) ?? {
      date,
      department: entry.department?.name ?? "N/A",
      section: entry.departmentSection?.name ?? "N/A",
      shift: entry.shift ?? "N/A",
      entries: 0,
      total: 0,
      reject: 0,
      net: 0,
      hours: 0,
      remarks: "",
    };
    row.entries = (row.entries as number) + 1;
    row.total = round4((row.total as number) + num(entry.qty));
    row.reject = round4((row.reject as number) + num(entry.rejectQty));
    row.net = round4((row.net as number) + num(entry.netQty));
    row.hours = round2((row.hours as number) + num(entry.hours));
    if (entry.remarks) remarks.set(key, (remarks.get(key) ?? new Set()).add(entry.remarks));
    groups.set(key, row);
  }
  const rows = [...groups.entries()].map(([key, row]) => ({ ...row, remarks: [...(remarks.get(key) ?? [])].join("; ") || "—" }));
  return {
    columns: [
      col("date", "Date", "date"),
      col("department", "Department"),
      col("section", "Section"),
      col("shift", "Shift"),
      col("entries", "Entries", "qty"),
      col("total", "Total Qty", "qty"),
      col("reject", "Reject Qty", "qty"),
      col("net", "Net Qty", "qty"),
      col("hours", "Run Hours", "hours"),
      col("remarks", "Operator Remarks"),
    ],
    rows,
    totals: totalsOf(rows, ["entries", "total", "reject", "net", "hours"], "date"),
  };
}

async function demandReport(ctx: Context): Promise<Built> {
  const { query } = ctx;
  const range = { gte: toDbDate(query.from), lte: toDbDate(query.to) };
  const itemWhere: Prisma.ItemWhereInput = {
    ...(query.itemId ? { id: query.itemId } : {}),
    ...(ctx.categoryIds ? { categoryId: { in: [...ctx.categoryIds] } } : {}),
  };
  const [demand, planned, produced] = await Promise.all([
    db().salesOrderLine.findMany({
      where: {
        item: itemWhere,
        order: { businessUnitId: { in: ctx.unitIds }, orderDate: range, status: { in: ["PENDING_APPROVAL", "APPROVED", "COMPLETED"] }, ...(query.officeId ? { officeId: query.officeId } : {}) },
      },
      select: { itemId: true, qty: true, item: { select: { code: true, name: true, uom: true } } },
    }),
    db().productionOrder.findMany({
      where: {
        businessUnitId: { in: ctx.unitIds },
        orderDate: range,
        status: { notIn: ["CANCELLED", "REJECTED"] },
        item: itemWhere,
        ...(query.officeId ? { officeId: query.officeId } : {}),
      },
      select: { itemId: true, orderQty: true, item: { select: { code: true, name: true, uom: true } } },
    }),
    entries(ctx),
  ]);
  const rows = new Map<string, Record<string, ReportCell>>();
  const touch = (itemId: string, item: { code: string; name: string; uom: string }) => {
    const row = rows.get(itemId) ?? { item: itemLabel(item), uom: item.uom, demand: 0, planned: 0, produced: 0, gap: 0, fulfilment: null };
    rows.set(itemId, row);
    return row;
  };
  const add = (itemId: string, item: { code: string; name: string; uom: string }, key: "demand" | "planned" | "produced", qty: number) => {
    const row = touch(itemId, item);
    row[key] = round4((row[key] as number) + qty);
  };
  for (const line of demand) add(line.itemId, line.item, "demand", num(line.qty));
  for (const order of planned) add(order.itemId, order.item, "planned", num(order.orderQty));
  for (const entry of produced) add(entry.itemId, entry.item, "produced", num(entry.netQty));
  const list = [...rows.values()]
    .map((row): Record<string, ReportCell> => ({ ...row, gap: round4((row.demand as number) - (row.produced as number)), fulfilment: pct(row.produced as number, row.demand as number) }))
    .sort((a, b) => String(a.item).localeCompare(String(b.item)));
  return {
    columns: [
      col("item", "Item"),
      col("uom", "UoM"),
      col("demand", "Demand (Sales Orders)", "qty"),
      col("planned", "Production Orders", "qty"),
      col("produced", "Produced Qty", "qty"),
      col("gap", "Gap (Demand − Produced)", "qty"),
      col("fulfilment", "Fulfilment (%)", "percent"),
    ],
    rows: list,
    totals: totalsOf(list, ["demand", "planned", "produced", "gap"], "item"),
    notes: ["Demand = confirmed sales order quantities ordered in the range; department, section and work center filters apply to the produced quantity only."],
  };
}

/** Overhead bucket of an expense account, by its name. */
function overheadBucket(accountName: string): "labour" | "power" | "other" {
  if (/salar|wage|labou?r|overtime|allowance/i.test(accountName)) return "labour";
  if (/electric|power|fuel|gas|utilit|energy/i.test(accountName)) return "power";
  return "other";
}

async function cogsReport(ctx: Context): Promise<Built> {
  const records = await db().productionEntry.findMany({
    where: entryWhere(ctx),
    include: {
      ...ENTRY_INCLUDE,
      order: { select: { ...ENTRY_INCLUDE.order.select, bom: { select: { ...ENTRY_INCLUDE.order.select.bom.select, overheads: { select: { amount: true, account: { select: { name: true } } } } } } } },
      materials: { select: { actualQty: true, rate: true, item: { select: { itemType: true } } } },
    },
    orderBy: [{ productionDate: "asc" }, { number: "asc" }],
  });
  const rows = records.map((entry) => {
    const net = num(entry.netQty);
    const packaging = entry.materials.filter((line) => line.item.itemType?.toLowerCase().includes("packaging"));
    const packagingCost = round2(packaging.reduce((sum, line) => sum + num(line.actualQty) * num(line.rate), 0));
    const materialCost = round2(num(entry.actualCost) - packagingCost);
    // Each overhead line of the BOM, per unit of this item (its cost share ÷ lot size), × good quantity.
    const output = entry.order.bom.outputs.find((line) => line.itemId === entry.itemId);
    const perUnit = output && num(output.lotSizeQty) > 0 ? num(output.costPercent) / 100 / num(output.lotSizeQty) : 0;
    const overhead = { labour: 0, power: 0, other: 0 };
    for (const line of entry.order.bom.overheads) overhead[overheadBucket(line.account.name)] += num(line.amount) * perUnit * net;
    const labour = round2(overhead.labour);
    const power = round2(overhead.power);
    const other = round2(overhead.other);
    const cogs = round2(materialCost + packagingCost + labour + power + other);
    return {
      batch: `${entry.number} / ${entry.order.number}`,
      item: itemLabel(entry.item),
      uom: entry.item.uom,
      net,
      material: materialCost,
      packaging: packagingCost,
      labour,
      power,
      other,
      cogs,
      unitCost: net > 0 ? round4(cogs / net) : null,
    };
  });
  return {
    columns: [
      col("batch", "Batch / Order No"),
      col("item", "Item Name"),
      col("uom", "UoM"),
      col("net", "Total Produced Qty", "qty"),
      col("material", "Raw Material Cost", "money"),
      col("packaging", "Packaging Cost", "money"),
      col("labour", "Direct Labor Overhead", "money"),
      col("power", "Power / Utility Overhead", "money"),
      col("other", "Other Overhead", "money"),
      col("cogs", "Total COGS Value", "money"),
      col("unitCost", "Unit Cost", "money"),
    ],
    rows,
    totals: totalsOf(rows, ["net", "material", "packaging", "labour", "power", "other", "cogs"], "batch"),
    notes: [
      "Material cost = actual consumption × BOM rate; packaging = materials whose item type is a packaging type.",
      "Overheads come from the BOM's overhead accounts per unit × good quantity: salary / wage / labour accounts are Direct Labor, electricity / power / fuel / gas / utility accounts are Power / Utility, others are Other Overhead.",
    ],
  };
}

const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** Work centers month by month: standard vs actual run hours, idle hours, output, efficiency and running cost. */
async function workCenterReport(ctx: Context): Promise<Built> {
  const [centers, records] = await Promise.all([
    db().productionWorkCenter.findMany({
      where: {
        businessUnitId: { in: ctx.unitIds },
        ...(ctx.query.workCenterId ? { id: ctx.query.workCenterId } : { isActive: true }),
        ...(ctx.query.departmentId ? { departmentId: ctx.query.departmentId } : {}),
        ...(ctx.query.departmentSectionId ? { departmentSectionId: ctx.query.departmentSectionId } : {}),
      },
      select: { id: true, code: true, name: true, standardRunHour: true, ratedCapacityPerHour: true, costPerHour: true },
      orderBy: { code: "asc" },
    }),
    db().productionEntry.findMany({ where: { ...entryWhere(ctx, false), workCenterId: { not: null } }, select: { workCenterId: true, hours: true, qty: true, productionDate: true } }),
  ]);
  // Days of each month that fall inside the range.
  const monthDays = new Map<string, number>();
  for (const date of daysOf(ctx.query.from, ctx.query.to)) monthDays.set(date.slice(0, 7), (monthDays.get(date.slice(0, 7)) ?? 0) + 1);
  const rows: Record<string, ReportCell>[] = [];
  for (const center of centers) {
    for (const [month, days] of monthDays) {
      const own = records.filter((entry) => entry.workCenterId === center.id && fromDbDate(entry.productionDate).startsWith(month));
      const standard = round2(num(center.standardRunHour) * days);
      const actual = round2(own.reduce((sum, entry) => sum + num(entry.hours), 0));
      const produced = round4(own.reduce((sum, entry) => sum + num(entry.qty), 0));
      rows.push({
        code: center.code,
        name: center.name,
        month: monthLabel(month),
        standard,
        actual,
        idle: round2(Math.max(standard - actual, 0)),
        produced,
        efficiency: pct(produced, num(center.ratedCapacityPerHour) * actual),
        cost: round2(num(center.costPerHour) * actual),
      });
    }
  }
  return {
    columns: [
      col("code", "Work Center Code"),
      col("name", "Work Center Name"),
      col("month", "Month"),
      col("standard", "Standard Run Hours", "hours"),
      col("actual", "Actual Run Hours", "hours"),
      col("idle", "Idle Hours", "hours"),
      col("produced", "Produced Qty", "qty"),
      col("efficiency", "Efficiency (%)", "percent"),
      col("cost", "Total Cost", "money"),
    ],
    rows,
    totals: totalsOf(rows, ["standard", "actual", "idle", "produced", "cost"], "code"),
    subtitle: [ctx.subtitle[0], `From: ${monthLabel(ctx.query.from.slice(0, 7))}  To: ${monthLabel(ctx.query.to.slice(0, 7))}`, ...ctx.subtitle.slice(2)],
    notes: [
      "Standard run hours = the work center's standard hours per day × days of the month; idle = standard − actual run hours.",
      "Efficiency = produced ÷ (rated capacity per hour × actual hours); Total Cost = cost per hour × actual hours.",
    ],
  };
}

/** Output per item against the materials it consumed (at BOM rates). */
async function outputConsumptionReport(ctx: Context): Promise<Built> {
  const records = await db().productionEntry.findMany({
    where: entryWhere(ctx),
    select: { itemId: true, qty: true, netQty: true, standardCost: true, actualCost: true, item: { select: { code: true, name: true, uom: true } }, _count: { select: { materials: true } } },
  });
  const groups = new Map<string, Record<string, ReportCell>>();
  for (const entry of records) {
    const row = groups.get(entry.itemId) ?? { item: itemLabel(entry.item), uom: entry.item.uom, batches: 0, total: 0, net: 0, standardCost: 0, actualCost: 0 };
    row.batches = (row.batches as number) + 1;
    row.total = round4((row.total as number) + num(entry.qty));
    row.net = round4((row.net as number) + num(entry.netQty));
    row.standardCost = round2((row.standardCost as number) + num(entry.standardCost));
    row.actualCost = round2((row.actualCost as number) + num(entry.actualCost));
    groups.set(entry.itemId, row);
  }
  const rows = [...groups.values()]
    .map((row): Record<string, ReportCell> => ({
      ...row,
      variance: round2((row.actualCost as number) - (row.standardCost as number)),
      variancePct: pct((row.actualCost as number) - (row.standardCost as number), row.standardCost as number),
      perUnit: (row.net as number) > 0 ? round4((row.actualCost as number) / (row.net as number)) : null,
    }))
    .sort((a, b) => String(a.item).localeCompare(String(b.item)));
  return {
    columns: [
      col("item", "Produced Item"),
      col("uom", "UoM"),
      col("batches", "Batches", "qty"),
      col("total", "Total Output", "qty"),
      col("net", "Good Output", "qty"),
      col("standardCost", "Standard Material Cost", "money"),
      col("actualCost", "Actual Material Cost", "money"),
      col("variance", "Variance", "money"),
      col("variancePct", "Variance (%)", "percent"),
      col("perUnit", "Material Cost / Unit", "money"),
    ],
    rows,
    totals: totalsOf(rows, ["batches", "total", "net", "standardCost", "actualCost", "variance"], "item"),
    notes: ["Standard = BOM quantities scaled to each batch at BOM rates; Variance = actual − standard (positive = more material used)."],
  };
}

/** Each sales order line against the production planned (production orders linked to it) and produced. */
async function salesOrderPlanningReport(ctx: Context): Promise<Built> {
  const { query } = ctx;
  const lines = await db().salesOrderLine.findMany({
    where: {
      order: {
        businessUnitId: { in: ctx.unitIds },
        orderDate: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
        status: { in: ["PENDING_APPROVAL", "APPROVED", "COMPLETED"] },
        ...(query.officeId ? { officeId: query.officeId } : {}),
      },
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(ctx.categoryIds ? { item: { categoryId: { in: [...ctx.categoryIds] } } } : {}),
    },
    select: {
      itemId: true,
      qty: true,
      item: { select: { code: true, name: true, uom: true } },
      order: { select: { id: true, number: true, orderDate: true, expectedDeliveryDate: true, customer: { select: { name: true } } } },
    },
    orderBy: [{ order: { orderDate: "asc" } }, { lineNo: "asc" }],
  });
  const plans = await db().productionOrder.findMany({
    where: { salesOrderId: { in: [...new Set(lines.map((line) => line.order.id))] }, status: { notIn: ["CANCELLED", "REJECTED"] } },
    select: { salesOrderId: true, itemId: true, orderQty: true, producedQty: true, number: true },
  });
  const rows = lines.map((line) => {
    const own = plans.filter((plan) => plan.salesOrderId === line.order.id && plan.itemId === line.itemId);
    const ordered = num(line.qty);
    const planned = round4(own.reduce((sum, plan) => sum + num(plan.orderQty), 0));
    const produced = round4(own.reduce((sum, plan) => sum + num(plan.producedQty), 0));
    return {
      salesOrder: line.order.number,
      orderDate: fromDbDate(line.order.orderDate),
      deliveryDate: fromDbDate(line.order.expectedDeliveryDate),
      customer: line.order.customer.name,
      item: itemLabel(line.item),
      uom: line.item.uom,
      ordered,
      planned,
      unplanned: round4(Math.max(ordered - planned, 0)),
      produced,
      productionOrders: own.map((plan) => plan.number).join(", ") || "—",
      status: produced >= ordered ? "Produced" : planned >= ordered ? "Planned" : planned > 0 ? "Partly planned" : "Not planned",
    };
  });
  return {
    columns: [
      col("salesOrder", "Sales Order"),
      col("orderDate", "Order Date", "date"),
      col("deliveryDate", "Delivery Date", "date"),
      col("customer", "Customer"),
      col("item", "Item"),
      col("uom", "UoM"),
      col("ordered", "Ordered Qty", "qty"),
      col("planned", "Planned Qty", "qty"),
      col("unplanned", "Not Planned", "qty"),
      col("produced", "Produced Qty", "qty"),
      col("productionOrders", "Production Orders"),
      col("status", "Status"),
    ],
    rows,
    totals: totalsOf(rows, ["ordered", "planned", "unplanned", "produced"], "salesOrder"),
    notes: ["Planned = production orders that reference the sales order for the same item (cancelled and rejected orders left out)."],
  };
}

/** Rejected (defective) quantity per month, item and work center. */
async function defectReport(ctx: Context): Promise<Built> {
  const records = await entries(ctx);
  const groups = new Map<string, Record<string, ReportCell>>();
  for (const entry of records) {
    const month = fromDbDate(entry.productionDate).slice(0, 7);
    const key = `${month}:${entry.itemId}:${entry.workCenterId ?? "-"}`;
    const row = groups.get(key) ?? { month, item: itemLabel(entry.item), workCenter: centerLabel(entry), uom: entry.item.uom, batches: 0, total: 0, rejected: 0, good: 0 };
    row.batches = (row.batches as number) + 1;
    row.total = round4((row.total as number) + num(entry.qty));
    row.rejected = round4((row.rejected as number) + num(entry.rejectQty));
    row.good = round4((row.good as number) + num(entry.netQty));
    groups.set(key, row);
  }
  const rows = [...groups.values()]
    .map((row): Record<string, ReportCell> => ({ ...row, month: monthLabel(row.month as string), defectRate: pct(row.rejected as number, row.total as number), sortKey: row.month }))
    .sort((a, b) => `${a.sortKey}${a.item}${a.workCenter}`.localeCompare(`${b.sortKey}${b.item}${b.workCenter}`))
    .map(({ sortKey: _sortKey, ...row }) => row);
  return {
    columns: [
      col("month", "Month"),
      col("item", "Item"),
      col("workCenter", "Work Center"),
      col("uom", "UoM"),
      col("batches", "Batches", "qty"),
      col("total", "Total Produced", "qty"),
      col("rejected", "Defective (Rejected) Qty", "qty"),
      col("good", "Good Qty", "qty"),
      col("defectRate", "Defect Rate (%)", "percent"),
    ],
    rows,
    totals: totalsOf(rows, ["batches", "total", "rejected", "good"], "month"),
    notes: ["Defective = the Reject QTY booked on production entries."],
  };
}

async function centersInScope(ctx: Context) {
  const { query } = ctx;
  return db().productionWorkCenter.findMany({
    where: {
      businessUnitId: { in: ctx.unitIds },
      ...(query.workCenterId ? { id: query.workCenterId } : { isActive: true }),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.departmentSectionId ? { departmentSectionId: query.departmentSectionId } : {}),
      ...(query.officeId ? { officeId: query.officeId } : {}),
    },
    select: { id: true, code: true, name: true, standardRunHour: true, ratedCapacityPerHour: true },
    orderBy: { code: "asc" },
  });
}

async function utilizationReport(ctx: Context): Promise<Built> {
  const [centers, records] = await Promise.all([centersInScope(ctx), db().productionEntry.findMany({ where: { ...entryWhere(ctx, false), workCenterId: { not: null } }, select: { workCenterId: true, hours: true, qty: true, productionDate: true } })]);
  const days = daysOf(ctx.query.from, ctx.query.to).length;
  const rows = centers.map((center) => {
    const own = records.filter((entry) => entry.workCenterId === center.id);
    const run = round2(own.reduce((sum, entry) => sum + num(entry.hours), 0));
    const produced = round4(own.reduce((sum, entry) => sum + num(entry.qty), 0));
    const available = round2(num(center.standardRunHour) * days);
    const capacity = round4(num(center.ratedCapacityPerHour) * run);
    return {
      workCenter: `${center.code} - ${center.name}`,
      activeDays: new Set(own.map((entry) => fromDbDate(entry.productionDate))).size,
      available,
      run,
      utilization: pct(run, available),
      capacity,
      produced,
      capacityUtilization: pct(produced, capacity),
    };
  });
  return {
    columns: [
      col("workCenter", "Work Center"),
      col("activeDays", "Production Days", "qty"),
      col("available", "Available Hours", "hours"),
      col("run", "Run Hours", "hours"),
      col("utilization", "Time Utilization (%)", "percent"),
      col("capacity", "Rated Capacity (Qty)", "qty"),
      col("produced", "Produced Qty", "qty"),
      col("capacityUtilization", "Capacity Utilization (%)", "percent"),
    ],
    rows,
    totals: totalsOf(rows, ["available", "run", "capacity", "produced"], "workCenter"),
    notes: ["Available hours = standard run hours per day × days in the range; rated capacity = rated capacity per hour × run hours."],
  };
}

async function downtimeReport(ctx: Context): Promise<Built> {
  const [centers, records] = await Promise.all([
    centersInScope(ctx),
    db().productionEntry.findMany({ where: { ...entryWhere(ctx, false), workCenterId: { not: null } }, select: { workCenterId: true, hours: true, qty: true, productionDate: true, shift: true } }),
  ]);
  const rows: Record<string, ReportCell>[] = [];
  for (const center of centers) {
    const planned = num(center.standardRunHour);
    for (const date of daysOf(ctx.query.from, ctx.query.to)) {
      const own = records.filter((entry) => entry.workCenterId === center.id && fromDbDate(entry.productionDate) === date);
      const run = round2(own.reduce((sum, entry) => sum + num(entry.hours), 0));
      const downtime = round2(Math.max(planned - run, 0));
      if (downtime <= 0) continue;
      const produced = round4(own.reduce((sum, entry) => sum + num(entry.qty), 0));
      rows.push({
        workCenter: `${center.code} - ${center.name}`,
        date,
        shift: [...new Set(own.map((entry) => entry.shift).filter(Boolean))].join(", ") || "—",
        operating: planned,
        run,
        downtime,
        produced,
        efficiency: pct(produced, num(center.ratedCapacityPerHour) * run),
        reason: own.length ? "Short run (reason not recorded)" : "No production recorded",
      });
    }
  }
  return {
    columns: [
      col("workCenter", "Work Center / Machine"),
      col("date", "Date", "date"),
      col("shift", "Shift"),
      col("operating", "Total Operating Hours", "hours"),
      col("run", "Actual Run Hours", "hours"),
      col("downtime", "Downtime Hours", "hours"),
      col("produced", "Produced Qty", "qty"),
      col("efficiency", "Efficiency (%)", "percent"),
      col("reason", "Downtime Reason"),
    ],
    rows,
    totals: totalsOf(rows, ["operating", "run", "downtime", "produced"], "workCenter"),
    notes: ["Downtime = standard run hours − run hours booked in production entries, per work center and day; days without any shortfall are left out."],
  };
}

const BUILDERS: Record<ReportType, (ctx: Context) => Promise<Built>> = {
  "work-center": workCenterReport,
  "output-consumption": outputConsumptionReport,
  "so-planning": salesOrderPlanningReport,
  defect: defectReport,
  production: productionReport,
  consumption: consumptionReport,
  performance: performanceReport,
  "process-date": processDateReport,
  details: detailsReport,
  "details-view": detailsViewReport,
  demand: demandReport,
  cogs: cogsReport,
  utilization: utilizationReport,
  downtime: downtimeReport,
};

export async function getReport(actor: Actor, raw: unknown): Promise<Report> {
  const query = reportQuerySchema.parse(raw);
  const ctx = await context(actor, query);
  const built = await BUILDERS[query.viewBy](ctx);
  return {
    type: query.viewBy,
    title: reportLabel(query.viewBy),
    company: ctx.company,
    subtitle: built.subtitle ?? ctx.subtitle,
    columns: built.columns,
    rows: built.rows,
    totals: built.totals,
    notes: built.notes ?? [],
  };
}

export async function reportLookups(actor: Actor): Promise<ReportLookups> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const inUnits = { businessUnitId: { in: unitIds } };
  const [unit, departments, sections, offices, workCenters, categories, boms, items] = await Promise.all([
    db().businessUnit.findFirst({ where: { id: { in: unitIds } }, select: { company: { select: { name: true } } }, orderBy: { name: "asc" } }),
    db().productionDepartment.findMany({ where: inUnits, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().productionDepartmentSection.findMany({ where: { department: inUnits }, select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" } }),
    db().office.findMany({ where: inUnits, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().productionWorkCenter.findMany({ where: inUnits, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    db().itemCategory.findMany({ where: { ...inUnits, level: { lte: 3 } }, select: { id: true, name: true, parentId: true, level: true }, orderBy: { name: "asc" } }),
    db().productionBom.findMany({ where: inUnits, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().item.findMany({ where: { ...inUnits, isActive: true }, select: { id: true, code: true, name: true, uom: true, itemType: true }, orderBy: { code: "asc" } }),
  ]);
  return {
    company: unit?.company.name ?? "",
    departments,
    sections,
    offices,
    workCenters,
    categories,
    boms,
    items,
    itemTypes: [...new Set([...ITEM_TYPES, ...items.map((item) => item.itemType).filter((type): type is string => !!type)])],
  };
}
