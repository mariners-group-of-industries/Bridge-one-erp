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

/** Category ids under the chosen category / sub category (an item may sit at level 3). */
async function categoryScope(unitIds: string[], categoryId?: string, subCategoryId?: string): Promise<Set<string> | null> {
  const root = subCategoryId ?? categoryId;
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
    categoryScope(unitIds, query.categoryId, query.subCategoryId),
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

async function processDateReport(ctx: Context): Promise<Built> {
  const records = await entries(ctx);
  const days = daysOf(ctx.query.from, ctx.query.to);
  const groups = new Map<string, Record<string, ReportCell>>();
  for (const entry of records) {
    const key = `${entry.workCenterId ?? "-"}:${entry.itemId}`;
    const row = groups.get(key) ?? { process: centerLabel(entry), item: itemLabel(entry.item), uom: entry.item.uom, total: 0 };
    const dayKey = `d${fromDbDate(entry.productionDate)}`;
    row[dayKey] = round4(((row[dayKey] as number | undefined) ?? 0) + num(entry.netQty));
    row.total = round4((row.total as number) + num(entry.netQty));
    groups.set(key, row);
  }
  const rows = [...groups.values()].sort((a, b) => `${a.process}${a.item}`.localeCompare(`${b.process}${b.item}`));
  const dayColumns = days.map((date) => col(`d${date}`, day(date).slice(0, 5), "qty"));
  return {
    columns: [col("process", "Process / Work Center"), col("item", "Item"), col("uom", "UoM"), ...dayColumns, col("total", "Total", "qty")],
    rows,
    totals: totalsOf(rows, [...dayColumns.map((column) => column.key), "total"], "process"),
    notes: ["Good (net) quantity per day."],
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

async function cogsReport(ctx: Context): Promise<Built> {
  const records = await db().productionEntry.findMany({
    where: entryWhere(ctx),
    include: { ...ENTRY_INCLUDE, materials: { select: { actualQty: true, rate: true, item: { select: { itemType: true } } } } },
    orderBy: [{ productionDate: "asc" }, { number: "asc" }],
  });
  const rows = records.map((entry) => {
    const packaging = entry.materials.filter((line) => line.item.itemType?.toLowerCase().includes("packaging"));
    const packagingCost = round2(packaging.reduce((sum, line) => sum + num(line.actualQty) * num(line.rate), 0));
    const materialCost = round2(num(entry.actualCost) - packagingCost);
    const output = entry.order.bom.outputs.find((line) => line.itemId === entry.itemId);
    const unitOverhead = output && num(output.lotSizeQty) > 0 ? (num(entry.order.bom.overheadCost) * num(output.costPercent)) / 100 / num(output.lotSizeQty) : 0;
    const overheadCost = round2(unitOverhead * num(entry.netQty));
    const cogs = round2(materialCost + packagingCost + overheadCost);
    return {
      date: fromDbDate(entry.productionDate),
      entry: entry.number,
      item: itemLabel(entry.item),
      net: num(entry.netQty),
      uom: entry.item.uom,
      material: materialCost,
      packaging: packagingCost,
      overhead: overheadCost,
      cogs,
      unitCost: num(entry.netQty) > 0 ? round4(cogs / num(entry.netQty)) : null,
    };
  });
  return {
    columns: [
      col("date", "Date", "date"),
      col("entry", "Entry Code"),
      col("item", "Produced Item"),
      col("net", "Net Qty", "qty"),
      col("uom", "UoM"),
      col("material", "Raw Material Cost", "money"),
      col("packaging", "Packaging Cost", "money"),
      col("overhead", "Overhead Cost", "money"),
      col("cogs", "Total COGS", "money"),
      col("unitCost", "Unit Cost", "money"),
    ],
    rows,
    totals: totalsOf(rows, ["net", "material", "packaging", "overhead", "cogs"], "date"),
    notes: [
      "Material cost = actual consumption × BOM rate; packaging = materials whose item type is a packaging type.",
      "Overhead = the BOM's overhead per unit (its cost share ÷ lot size) × net quantity.",
    ],
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
    db().itemCategory.findMany({ where: { ...inUnits, level: { lte: 2 } }, select: { id: true, name: true, parentId: true, level: true }, orderBy: { name: "asc" } }),
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
