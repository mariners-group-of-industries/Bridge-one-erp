import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { money } from "../../dashboard/lib/aggregate";
import { fromDbDate, toDbDate } from "../../lib/dates";
import { requireBusinessUnit, requireOffice, scopedBusinessUnitIds } from "../../lib/scope";
import { formatNumber, nextNumber } from "../../lib/sequence";
import { userNames } from "../../lib/users";
import {
  assignInputSchema,
  budgetInputSchema,
  budgetPersonSchema,
  budgetUpdateSchema,
  commissionInputSchema,
  commissionReportQuerySchema,
  commissionUpdateSchema,
  planInputSchema,
  planListQuerySchema,
  planReportQuerySchema,
  planUpdateSchema,
  targetReportQuerySchema,
  type BudgetDetail,
  type BudgetRow,
  type CommissionDetail,
  type CommissionReport,
  type CommissionReportLine,
  type CommissionRow,
  type PlanDetail,
  type PlanReportRow,
  type PlanRow,
  type TargetReportRow,
} from "../schemas/target.schema";

const num = (value: Prisma.Decimal | null | undefined) => (value ? value.toNumber() : 0);
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const LIVE = "SUBMITTED" as const;
const isUnique = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
const monthStart = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));
const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0));

async function requireSalesPersons(businessUnitId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const found = await db().salesPerson.count({ where: { id: { in: unique }, businessUnitId } });
  if (found !== unique.length) throw badRequest("A sales force does not belong to this business unit.");
}

async function requireCustomerGroups(businessUnitId: string, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (!unique.length) return;
  const found = await db().customerGroup.count({ where: { id: { in: unique }, businessUnitId } });
  if (found !== unique.length) throw badRequest("A customer group does not belong to this business unit.");
}

// ─── Budgets (Target tab) ────────────────────────────────────────────────────

const budgetInclude = {
  businessUnit: { select: { companyId: true } },
  lines: { select: { salesPersonId: true, month: true, amount: true, qty: true, salesPerson: { select: { name: true, designation: true } } } },
} satisfies Prisma.SalesTargetBudgetInclude;
type BudgetRecord = Prisma.SalesTargetBudgetGetPayload<{ include: typeof budgetInclude }>;

const lineValue = (basis: string, line: { amount: Prisma.Decimal; qty: Prisma.Decimal | null }) => (basis === "QUANTITY" ? num(line.qty) : num(line.amount));

function toBudgetRow(record: BudgetRecord, nameOf: (id: string | null) => string | null): BudgetRow {
  return {
    id: record.id,
    businessUnitId: record.businessUnitId,
    targetType: "EMPLOYEE",
    basis: record.basis,
    year: record.year,
    total: round3(record.lines.reduce((sum, line) => sum + lineValue(record.basis, line), 0)),
    personCount: new Set(record.lines.map((line) => line.salesPersonId)).size,
    createdBy: nameOf(record.createdBy),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listBudgets(actor: Actor): Promise<BudgetRow[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const records = await db().salesTargetBudget.findMany({ where: { businessUnitId: { in: unitIds } }, include: budgetInclude, orderBy: [{ year: "desc" }, { basis: "asc" }] });
  const nameOf = await userNames(records.map((record) => record.createdBy));
  return records.map((record) => toBudgetRow(record, nameOf));
}

async function loadBudget(actor: Actor, id: string) {
  const record = await db().salesTargetBudget.findUnique({ where: { id }, include: budgetInclude });
  if (!record) throw notFound("Target");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Target");
  return record;
}

export async function getBudget(actor: Actor, id: string): Promise<BudgetDetail> {
  const record = await loadBudget(actor, id);
  const nameOf = await userNames([record.createdBy]);
  const byPerson = new Map<string, BudgetDetail["persons"][number]>();
  for (const line of [...record.lines].sort((a, b) => a.month.getTime() - b.month.getTime())) {
    let person = byPerson.get(line.salesPersonId);
    if (!person) {
      person = { salesPersonId: line.salesPersonId, name: line.salesPerson.name, designation: line.salesPerson.designation, months: [], total: 0 };
      byPerson.set(line.salesPersonId, person);
    }
    const value = lineValue(record.basis, line);
    person.months.push({ month: line.month.getUTCMonth() + 1, value });
    person.total = round3(person.total + value);
  }
  return { ...toBudgetRow(record, nameOf), persons: [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

function budgetLines(businessUnitId: string, basis: "AMOUNT" | "QUANTITY", year: number, budgetId: string, persons: { salesPersonId: string; months: { month: number; value: number }[] }[]) {
  return persons.flatMap((person) =>
    person.months.map((entry) => ({
      businessUnitId,
      budgetId,
      salesPersonId: person.salesPersonId,
      month: monthStart(year, entry.month),
      amount: basis === "AMOUNT" ? entry.value : 0,
      qty: basis === "QUANTITY" ? entry.value : null,
    })),
  );
}

export async function createBudget(actor: Actor, raw: unknown): Promise<BudgetDetail> {
  const input = budgetInputSchema.parse(raw);
  await requireBusinessUnit(actor, input.businessUnitId);
  await requireSalesPersons(input.businessUnitId, input.persons.map((person) => person.salesPersonId));
  try {
    const id = await db().$transaction(async (tx) => {
      const budget = await tx.salesTargetBudget.create({
        data: { businessUnitId: input.businessUnitId, targetType: input.targetType, basis: input.basis, year: input.year, createdBy: actor.id, updatedBy: actor.id },
        select: { id: true },
      });
      await tx.salesTarget.createMany({ data: budgetLines(input.businessUnitId, input.basis, input.year, budget.id, input.persons) });
      return budget.id;
    });
    return getBudget(actor, id);
  } catch (error) {
    if (isUnique(error)) throw conflict(`There is already a ${input.basis === "AMOUNT" ? "amount" : "quantity"} based target for ${input.year}. Edit it instead.`);
    throw error;
  }
}

export async function updateBudget(actor: Actor, id: string, raw: unknown): Promise<BudgetDetail> {
  const { version, data } = budgetUpdateSchema.parse(raw);
  const existing = await loadBudget(actor, id);
  if (data.businessUnitId !== existing.businessUnitId) throw badRequest("The business unit of a target cannot change.");
  await requireSalesPersons(existing.businessUnitId, data.persons.map((person) => person.salesPersonId));
  try {
    await db().$transaction(async (tx) => {
      const { count } = await tx.salesTargetBudget.updateMany({
        where: { id, updatedAt: new Date(version) },
        data: { basis: data.basis, year: data.year, targetType: data.targetType, updatedBy: actor.id },
      });
      if (count === 0) throw conflict("Someone else changed this target. Reload it and try again.");
      await tx.salesTarget.deleteMany({ where: { budgetId: id } });
      await tx.salesTarget.createMany({ data: budgetLines(existing.businessUnitId, data.basis, data.year, id, data.persons) });
    });
  } catch (error) {
    if (isUnique(error)) throw conflict(`There is already a ${data.basis === "AMOUNT" ? "amount" : "quantity"} based target for ${data.year}.`);
    throw error;
  }
  return getBudget(actor, id);
}

/** Details dialog: replaces one sales force's months (no months removes the sales force). */
export async function saveBudgetPerson(actor: Actor, id: string, raw: unknown): Promise<BudgetDetail> {
  const input = budgetPersonSchema.parse(raw);
  const existing = await loadBudget(actor, id);
  await requireSalesPersons(existing.businessUnitId, [input.salesPersonId]);
  await db().$transaction(async (tx) => {
    await tx.salesTarget.deleteMany({ where: { budgetId: id, salesPersonId: input.salesPersonId } });
    if (input.months.length) await tx.salesTarget.createMany({ data: budgetLines(existing.businessUnitId, existing.basis, existing.year, id, [input]) });
    await tx.salesTargetBudget.update({ where: { id }, data: { updatedBy: actor.id } });
  });
  return getBudget(actor, id);
}

export async function deleteBudget(actor: Actor, id: string): Promise<void> {
  await loadBudget(actor, id);
  await db().salesTargetBudget.delete({ where: { id } });
}

// ─── Target Report ───────────────────────────────────────────────────────────

export async function targetReport(actor: Actor, raw: unknown): Promise<TargetReportRow[]> {
  const query = targetReportQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const range = { gte: monthStart(query.year, query.fromMonth), lte: monthEnd(query.year, query.toMonth) };
  const person = query.salesPersonId ? { salesPersonId: query.salesPersonId } : { salesPersonId: { not: null } };
  const quantity = query.basis === "QUANTITY";

  const [targets, deliveries, returns] = await Promise.all([
    db().salesTarget.findMany({
      where: { businessUnitId: { in: unitIds }, budget: { basis: query.basis }, month: range, ...(query.salesPersonId ? { salesPersonId: query.salesPersonId } : {}) },
      select: { salesPersonId: true, month: true, amount: true, qty: true },
    }),
    db().salesDelivery.findMany({ where: { businessUnitId: { in: unitIds }, status: LIVE, deliveryDate: range, ...person }, select: { salesPersonId: true, deliveryDate: true, totalAmount: true, totalQty: true } }),
    db().salesReturn.findMany({ where: { businessUnitId: { in: unitIds }, status: LIVE, returnDate: range, ...person }, select: { salesPersonId: true, returnDate: true, totalAmount: true, totalQty: true } }),
  ]);

  const cells = new Map<string, { salesPersonId: string; month: number; target: number; achieved: number }>();
  const cell = (salesPersonId: string, month: number) => {
    const key = `${salesPersonId}:${month}`;
    let value = cells.get(key);
    if (!value) cells.set(key, (value = { salesPersonId, month, target: 0, achieved: 0 }));
    return value;
  };
  for (const row of targets) cell(row.salesPersonId, row.month.getUTCMonth() + 1).target += quantity ? num(row.qty) : num(row.amount);
  for (const row of deliveries) cell(row.salesPersonId!, row.deliveryDate.getUTCMonth() + 1).achieved += quantity ? num(row.totalQty) : num(row.totalAmount);
  for (const row of returns) cell(row.salesPersonId!, row.returnDate.getUTCMonth() + 1).achieved -= quantity ? num(row.totalQty) : num(row.totalAmount);

  const persons = await db().salesPerson.findMany({ where: { id: { in: [...new Set([...cells.values()].map((row) => row.salesPersonId))] } }, select: { id: true, name: true, designation: true } });
  const byId = new Map(persons.map((row) => [row.id, row]));
  return [...cells.values()]
    .map((row) => {
      const target = round3(row.target);
      const achieved = quantity ? round3(row.achieved) : money(row.achieved);
      return {
        salesPersonId: row.salesPersonId,
        name: byId.get(row.salesPersonId)?.name ?? "Unknown",
        designation: byId.get(row.salesPersonId)?.designation ?? null,
        month: row.month,
        target,
        achieved,
        percent: target > 0 ? Math.round((achieved / target) * 10_000) / 100 : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.month - b.month);
}

// ─── Target plans (Sales Target tab) ─────────────────────────────────────────

const planInclude = {
  businessUnit: { select: { companyId: true } },
  office: { select: { name: true } },
  lines: {
    orderBy: { lineNo: "asc" },
    include: { customer: { select: { name: true } }, customerGroup: { select: { name: true } }, item: { select: { name: true } } },
  },
  assignments: {
    include: { salesPerson: { select: { name: true, designation: true } }, customerGroup: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.SalesTargetPlanInclude;
type PlanRecord = Prisma.SalesTargetPlanGetPayload<{ include: typeof planInclude }>;

function toPlanRow(record: PlanRecord, nameOf: (id: string | null) => string | null): PlanRow {
  return {
    id: record.id,
    number: record.number,
    name: record.name,
    basis: record.basis,
    businessUnitId: record.businessUnitId,
    officeId: record.officeId,
    officeName: record.office.name,
    createDate: fromDbDate(record.createDate),
    startDate: fromDbDate(record.startDate),
    endDate: fromDbDate(record.endDate),
    targetAmount: num(record.targetAmount),
    customers: record.lines.length,
    assigned: record.assignments.length,
    createdBy: nameOf(record.createdBy),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listPlans(actor: Actor, raw: unknown): Promise<PlanRow[]> {
  const query = planListQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const records = await db().salesTargetPlan.findMany({
    where: {
      businessUnitId: { in: unitIds },
      status: LIVE,
      ...(query.officeId ? { officeId: query.officeId } : {}),
      ...(query.basis ? { basis: query.basis } : {}),
      ...(query.name ? { name: { contains: query.name, mode: "insensitive" } } : {}),
      // Plans that run at any time in the range.
      ...(query.to ? { startDate: { lte: toDbDate(query.to) } } : {}),
      ...(query.from ? { endDate: { gte: toDbDate(query.from) } } : {}),
    },
    include: planInclude,
    orderBy: [{ startDate: "desc" }, { number: "desc" }],
  });
  const nameOf = await userNames(records.map((record) => record.createdBy));
  return records.map((record) => toPlanRow(record, nameOf));
}

async function loadPlan(actor: Actor, id: string) {
  const record = await db().salesTargetPlan.findUnique({ where: { id }, include: planInclude });
  if (!record || record.status !== LIVE) throw notFound("Sales target");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Sales target");
  return record;
}

export async function getPlan(actor: Actor, id: string): Promise<PlanDetail> {
  const record = await loadPlan(actor, id);
  const nameOf = await userNames([record.createdBy]);
  return {
    ...toPlanRow(record, nameOf),
    remarks: record.remarks,
    customerGroupWise: record.customerGroupWise,
    lines: record.lines.map((line) => ({
      lineNo: line.lineNo,
      customerId: line.customerId,
      customerName: line.customer?.name ?? null,
      customerGroupId: line.customerGroupId,
      customerGroupName: line.customerGroup?.name ?? null,
      itemId: line.itemId,
      itemName: line.item?.name ?? null,
      rate: line.rate === null ? null : num(line.rate),
      qty: line.qty === null ? null : num(line.qty),
      amount: num(line.amount),
    })),
    assignments: record.assignments.map((row) => ({
      id: row.id,
      salesPersonId: row.salesPersonId,
      salesPersonName: row.salesPerson.name,
      designation: row.salesPerson.designation,
      customerGroupId: row.customerGroupId,
      customerGroupName: row.customerGroup?.name ?? null,
      targetAmount: num(row.targetAmount),
      commissionBasis: row.commissionBasis,
      commissionRate: num(row.commissionRate),
      minimumCollection: num(row.minimumCollection),
    })),
  };
}

async function planData(actor: Actor, raw: unknown) {
  const input = planInputSchema.parse(raw);
  const office = await requireOffice(actor, input.officeId);
  const businessUnitId = office.businessUnitId;
  const customerIds = [...new Set(input.lines.map((line) => line.customerId).filter((id): id is string => !!id))];
  const itemIds = [...new Set(input.lines.map((line) => line.itemId).filter((id): id is string => !!id))];
  if (customerIds.length && (await db().customer.count({ where: { id: { in: customerIds }, businessUnitId } })) !== customerIds.length) {
    throw badRequest("A customer does not belong to the office's business unit.");
  }
  if (itemIds.length && (await db().item.count({ where: { id: { in: itemIds }, businessUnitId } })) !== itemIds.length) {
    throw badRequest("An item does not belong to the office's business unit.");
  }
  await requireCustomerGroups(businessUnitId, input.lines.map((line) => line.customerGroupId));
  return {
    businessUnitId,
    header: {
      officeId: office.id,
      createDate: toDbDate(input.createDate),
      basis: input.basis,
      name: input.name,
      targetAmount: input.targetAmount,
      startDate: toDbDate(input.startDate),
      endDate: toDbDate(input.endDate),
      remarks: input.remarks,
      customerGroupWise: input.customerGroupWise,
    },
    lines: input.lines.map((line, index) => ({
      lineNo: index + 1,
      customerId: input.customerGroupWise ? null : line.customerId,
      customerGroupId: input.customerGroupWise ? line.customerGroupId : null,
      itemId: line.itemId,
      rate: line.rate,
      qty: line.qty,
      amount: line.amount,
    })),
  };
}

export async function createPlan(actor: Actor, raw: unknown): Promise<PlanDetail> {
  const { businessUnitId, header, lines } = await planData(actor, raw);
  const year = header.createDate.getUTCFullYear();
  const id = await db().$transaction(async (tx) => {
    const created = await tx.salesTargetPlan.create({
      data: {
        ...header,
        businessUnitId,
        number: formatNumber("ST", year, await nextNumber(tx, businessUnitId, "SALES_TARGET_PLAN", year)),
        createdBy: actor.id,
        updatedBy: actor.id,
        lines: { create: lines },
      },
      select: { id: true },
    });
    return created.id;
  });
  return getPlan(actor, id);
}

export async function updatePlan(actor: Actor, id: string, raw: unknown): Promise<PlanDetail> {
  const { version, data } = planUpdateSchema.parse(raw);
  const existing = await loadPlan(actor, id);
  const { businessUnitId, header, lines } = await planData(actor, data);
  if (businessUnitId !== existing.businessUnitId) throw badRequest("The office must stay in the same business unit.");
  await db().$transaction(async (tx) => {
    const { count } = await tx.salesTargetPlan.updateMany({ where: { id, status: LIVE, updatedAt: new Date(version) }, data: { ...header, updatedBy: actor.id } });
    if (count === 0) throw conflict("Someone else changed this target. Reload it and try again.");
    await tx.salesTargetPlanLine.deleteMany({ where: { planId: id } });
    await tx.salesTargetPlanLine.createMany({ data: lines.map((line) => ({ ...line, planId: id })) });
  });
  return getPlan(actor, id);
}

export async function deletePlan(actor: Actor, id: string): Promise<void> {
  await loadPlan(actor, id);
  await db().salesTargetPlan.update({ where: { id }, data: { status: "CANCELLED", updatedBy: actor.id } });
}

/** Assign Sales Force: adds or replaces the sales force's share of a target. */
export async function assignPlan(actor: Actor, raw: unknown): Promise<PlanDetail> {
  const input = assignInputSchema.parse(raw);
  const plan = await loadPlan(actor, input.planId);
  await requireSalesPersons(plan.businessUnitId, input.rows.map((row) => row.salesPersonId));
  await requireCustomerGroups(plan.businessUnitId, input.rows.map((row) => row.customerGroupId));
  await db().$transaction(async (tx) => {
    for (const row of input.rows) {
      const data = {
        customerGroupId: row.customerGroupId,
        targetAmount: row.targetAmount,
        commissionBasis: row.commissionBasis,
        commissionRate: row.commissionRate,
        minimumCollection: row.minimumCollection,
      };
      await tx.salesTargetAssignment.upsert({
        where: { planId_salesPersonId: { planId: plan.id, salesPersonId: row.salesPersonId } },
        create: { ...data, planId: plan.id, salesPersonId: row.salesPersonId, createdBy: actor.id },
        update: data,
      });
    }
  });
  return getPlan(actor, plan.id);
}

export async function deleteAssignment(actor: Actor, id: string): Promise<void> {
  const row = await db().salesTargetAssignment.findUnique({ where: { id }, select: { plan: { select: { businessUnit: { select: { companyId: true } } } } } });
  if (!row) throw notFound("Assignment");
  assertCompanyAccess(actor, row.plan.businessUnit.companyId, "Assignment");
  await db().salesTargetAssignment.delete({ where: { id } });
}

// ─── Sales Target Report ─────────────────────────────────────────────────────

export async function planReport(actor: Actor, raw: unknown): Promise<PlanReportRow[]> {
  const query = planReportQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const plans = await db().salesTargetPlan.findMany({
    where: {
      businessUnitId: { in: unitIds },
      status: LIVE,
      ...(query.planId ? { id: query.planId } : {}),
      ...(query.officeId ? { officeId: query.officeId } : {}),
      ...(query.to ? { startDate: { lte: toDbDate(query.to) } } : {}),
      ...(query.from ? { endDate: { gte: toDbDate(query.from) } } : {}),
    },
    include: planInclude,
    orderBy: [{ startDate: "desc" }, { number: "desc" }],
  });
  const groupNames = new Map((await db().customerGroup.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, name: true } })).map((row) => [row.id, row.name]));

  const rows: PlanReportRow[] = [];
  for (const plan of plans) {
    const period = { gte: plan.startDate, lte: plan.endDate };
    const customerIds = plan.lines.map((line) => line.customerId).filter((id): id is string => !!id);
    const groupIds = plan.lines.map((line) => line.customerGroupId).filter((id): id is string => !!id);
    const itemIds = [...new Set(plan.lines.map((line) => line.itemId).filter((id): id is string => !!id))];
    const quantity = plan.basis === "QUANTITY";

    for (const assignment of plan.assignments) {
      if (query.salesPersonId && assignment.salesPersonId !== query.salesPersonId) continue;
      if (query.designation && !(assignment.salesPerson.designation ?? "").toLowerCase().includes(query.designation.toLowerCase())) continue;
      // Customers the target covers, narrowed to the assignment's customer group.
      const customer: Prisma.CustomerWhereInput = {
        ...(customerIds.length ? { id: { in: customerIds } } : {}),
        ...(groupIds.length ? { customerGroupId: { in: groupIds } } : {}),
        ...(assignment.customerGroupId ? { AND: [{ customerGroupId: assignment.customerGroupId }] } : {}),
      };
      const scope = { businessUnitId: plan.businessUnitId, status: LIVE, salesPersonId: assignment.salesPersonId, customer };
      const [deliveries, returns, collections] = await Promise.all([
        db().salesDelivery.findMany({
          where: { ...scope, deliveryDate: period },
          select: {
            totalAmount: true,
            totalQty: true,
            customer: { select: { customerGroupId: true } },
            lines: itemIds.length ? { where: { itemId: { in: itemIds } }, select: { qty: true, amount: true } } : { take: 0, select: { qty: true, amount: true } },
          },
        }),
        db().salesReturn.findMany({
          where: { ...scope, returnDate: period },
          select: {
            totalAmount: true,
            totalQty: true,
            customer: { select: { customerGroupId: true } },
            lines: itemIds.length ? { where: { itemId: { in: itemIds } }, select: { qty: true, amount: true } } : { take: 0, select: { qty: true, amount: true } },
          },
        }),
        db().salesCollection.findMany({ where: { ...scope, collectionDate: period }, select: { amount: true, customer: { select: { customerGroupId: true } } } }),
      ]);

      // Sales value and quantity, only of the target's items when it names items.
      const valueOf = (row: { totalAmount: Prisma.Decimal; totalQty: Prisma.Decimal; lines: { qty: Prisma.Decimal; amount: Prisma.Decimal }[] }) =>
        itemIds.length
          ? { amount: row.lines.reduce((sum, line) => sum + num(line.amount), 0), qty: row.lines.reduce((sum, line) => sum + num(line.qty), 0) }
          : { amount: num(row.totalAmount), qty: num(row.totalQty) };
      const buckets = new Map<string, { amount: number; qty: number; collection: number }>();
      const bucket = (groupId: string | null) => {
        const key = query.byCustomerGroup ? (groupId ?? "") : "";
        let value = buckets.get(key);
        if (!value) buckets.set(key, (value = { amount: 0, qty: 0, collection: 0 }));
        return value;
      };
      for (const row of deliveries) {
        const value = valueOf(row);
        const target = bucket(row.customer.customerGroupId);
        target.amount += value.amount;
        target.qty += value.qty;
      }
      for (const row of returns) {
        const value = valueOf(row);
        const target = bucket(row.customer.customerGroupId);
        target.amount -= value.amount;
        target.qty -= value.qty;
      }
      for (const row of collections) bucket(row.customer.customerGroupId).collection += num(row.amount);
      if (buckets.size === 0) bucket(null);

      const targetAmount = num(assignment.targetAmount);
      const rate = num(assignment.commissionRate);
      const minimumCollection = num(assignment.minimumCollection);
      for (const [key, value] of buckets) {
        const achievedAmount = money(value.amount);
        const achieved = quantity ? round3(value.qty) : achievedAmount;
        const collection = money(value.collection);
        const earned = !query.byCustomerGroup && achieved >= targetAmount && collection >= minimumCollection;
        rows.push({
          key: `${assignment.id}:${key}`,
          planId: plan.id,
          planNumber: plan.number,
          planName: plan.name,
          basis: plan.basis,
          startDate: fromDbDate(plan.startDate),
          endDate: fromDbDate(plan.endDate),
          salesPersonId: assignment.salesPersonId,
          salesPersonName: assignment.salesPerson.name,
          designation: assignment.salesPerson.designation,
          customerGroupName: query.byCustomerGroup ? (key ? (groupNames.get(key) ?? "Unknown") : "No group") : (assignment.customerGroup?.name ?? null),
          targetAmount,
          achieved,
          achievedAmount,
          percent: targetAmount > 0 ? Math.round((achieved / targetAmount) * 10_000) / 100 : 0,
          collection,
          minimumCollection,
          commissionBasis: assignment.commissionBasis,
          commissionRate: rate,
          commission: earned ? (assignment.commissionBasis === "AMOUNT" ? money(rate) : money((achievedAmount * rate) / 100)) : 0,
          earned,
        });
      }
    }
  }
  return rows;
}

// ─── Commission setup ────────────────────────────────────────────────────────

const commissionInclude = {
  businessUnit: { select: { companyId: true } },
  salesPerson: { select: { name: true } },
  customerGroup: { select: { name: true } },
  lines: { include: { item: { select: { code: true, name: true, uom: true } } } },
} satisfies Prisma.SalesCommissionInclude;
type CommissionRecord = Prisma.SalesCommissionGetPayload<{ include: typeof commissionInclude }>;

function toCommissionRow(record: CommissionRecord, nameOf: (id: string | null) => string | null): CommissionRow {
  return {
    id: record.id,
    name: record.name,
    businessUnitId: record.businessUnitId,
    salesPersonId: record.salesPersonId,
    salesPersonName: record.salesPerson.name,
    customerGroupId: record.customerGroupId,
    customerGroupName: record.customerGroup?.name ?? null,
    fromDate: fromDbDate(record.fromDate),
    toDate: fromDbDate(record.toDate),
    items: record.lines.length,
    createdBy: nameOf(record.createdBy),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listCommissions(actor: Actor): Promise<CommissionRow[]> {
  const unitIds = await scopedBusinessUnitIds(actor);
  const records = await db().salesCommission.findMany({ where: { businessUnitId: { in: unitIds }, status: LIVE }, include: commissionInclude, orderBy: [{ fromDate: "desc" }, { name: "asc" }] });
  const nameOf = await userNames(records.map((record) => record.createdBy));
  return records.map((record) => toCommissionRow(record, nameOf));
}

async function loadCommission(actor: Actor, id: string) {
  const record = await db().salesCommission.findUnique({ where: { id }, include: commissionInclude });
  if (!record || record.status !== LIVE) throw notFound("Commission");
  assertCompanyAccess(actor, record.businessUnit.companyId, "Commission");
  return record;
}

export async function getCommission(actor: Actor, id: string): Promise<CommissionDetail> {
  const record = await loadCommission(actor, id);
  const nameOf = await userNames([record.createdBy]);
  return {
    ...toCommissionRow(record, nameOf),
    lines: record.lines
      .map((line) => ({ itemId: line.itemId, itemCode: line.item.code, itemName: line.item.name, uom: line.item.uom, basis: line.basis, value: num(line.value) }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName)),
  };
}

/** One live commission per sales force, item and day: overlapping setups would pay twice. */
async function commissionData(raw: unknown, excludeId: string | null) {
  const input = commissionInputSchema.parse(raw);
  const person = await db().salesPerson.findUnique({ where: { id: input.salesPersonId }, select: { businessUnitId: true } });
  if (!person) throw badRequest("Employee not found.");
  const businessUnitId = person.businessUnitId;
  const itemIds = input.lines.map((line) => line.itemId);
  if ((await db().item.count({ where: { id: { in: itemIds }, businessUnitId } })) !== itemIds.length) throw badRequest("An item does not belong to the employee's business unit.");
  await requireCustomerGroups(businessUnitId, [input.customerGroupId]);
  const clash = await db().salesCommissionLine.findFirst({
    where: {
      itemId: { in: itemIds },
      commission: {
        status: LIVE,
        salesPersonId: input.salesPersonId,
        fromDate: { lte: toDbDate(input.toDate) },
        toDate: { gte: toDbDate(input.fromDate) },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    },
    select: { item: { select: { name: true } }, commission: { select: { name: true } } },
  });
  if (clash) throw conflict(`${clash.item.name} already has a commission for this employee in "${clash.commission.name}" during these dates.`);
  return { businessUnitId, input };
}

export async function createCommission(actor: Actor, raw: unknown): Promise<CommissionDetail> {
  const { businessUnitId, input } = await commissionData(raw, null);
  const created = await db().salesCommission.create({
    data: {
      businessUnitId,
      name: input.name,
      salesPersonId: input.salesPersonId,
      customerGroupId: input.customerGroupId,
      fromDate: toDbDate(input.fromDate),
      toDate: toDbDate(input.toDate),
      createdBy: actor.id,
      updatedBy: actor.id,
      lines: { create: input.lines },
    },
    select: { id: true, businessUnit: { select: { companyId: true } } },
  });
  assertCompanyAccess(actor, created.businessUnit.companyId, "Commission");
  return getCommission(actor, created.id);
}

export async function updateCommission(actor: Actor, id: string, raw: unknown): Promise<CommissionDetail> {
  const { version, data } = commissionUpdateSchema.parse(raw);
  const existing = await loadCommission(actor, id);
  const { businessUnitId, input } = await commissionData(data, id);
  if (businessUnitId !== existing.businessUnitId) throw badRequest("The employee must stay in the same business unit.");
  await db().$transaction(async (tx) => {
    const { count } = await tx.salesCommission.updateMany({
      where: { id, status: LIVE, updatedAt: new Date(version) },
      data: { name: input.name, salesPersonId: input.salesPersonId, customerGroupId: input.customerGroupId, fromDate: toDbDate(input.fromDate), toDate: toDbDate(input.toDate), updatedBy: actor.id },
    });
    if (count === 0) throw conflict("Someone else changed this commission. Reload it and try again.");
    await tx.salesCommissionLine.deleteMany({ where: { commissionId: id } });
    await tx.salesCommissionLine.createMany({ data: input.lines.map((line) => ({ ...line, commissionId: id })) });
  });
  return getCommission(actor, id);
}

export async function deleteCommission(actor: Actor, id: string): Promise<void> {
  await loadCommission(actor, id);
  await db().salesCommission.update({ where: { id }, data: { status: "CANCELLED", updatedBy: actor.id } });
}

// ─── Commission Report ───────────────────────────────────────────────────────

export async function commissionReport(actor: Actor, raw: unknown): Promise<CommissionReport> {
  const query = commissionReportQuerySchema.parse(raw);
  const unitIds = await scopedBusinessUnitIds(actor);
  const from = toDbDate(query.from);
  const to = toDbDate(query.to);

  // Items of the chosen category and everything under it.
  let categoryIds: Set<string> | null = null;
  if (query.categoryId) {
    const categories = await db().itemCategory.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, parentId: true } });
    categoryIds = new Set([query.categoryId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const category of categories) {
        if (category.parentId && categoryIds.has(category.parentId) && !categoryIds.has(category.id)) {
          categoryIds.add(category.id);
          grew = true;
        }
      }
    }
  }

  const commissions = await db().salesCommission.findMany({
    where: { businessUnitId: { in: unitIds }, status: LIVE, fromDate: { lte: to }, toDate: { gte: from } },
    include: { salesPerson: { select: { name: true } }, lines: true },
  });

  const lines: CommissionReportLine[] = [];
  for (const commission of commissions) {
    const rates = new Map(commission.lines.map((line) => [line.itemId, line]));
    const deliveryLines = await db().salesDeliveryLine.findMany({
      where: {
        itemId: { in: [...rates.keys()] },
        ...(categoryIds ? { item: { categoryId: { in: [...categoryIds] } } } : {}),
        delivery: {
          status: LIVE,
          salesPersonId: commission.salesPersonId,
          deliveryDate: { gte: from > commission.fromDate ? from : commission.fromDate, lte: to < commission.toDate ? to : commission.toDate },
          ...(query.officeId ? { officeId: query.officeId } : {}),
          ...(commission.customerGroupId ? { customer: { customerGroupId: commission.customerGroupId } } : {}),
        },
      },
      select: {
        id: true,
        itemId: true,
        qty: true,
        amount: true,
        item: { select: { code: true, name: true } },
        delivery: { select: { id: true, number: true, deliveryDate: true, customer: { select: { name: true } } } },
        returnLines: { where: { salesReturn: { status: LIVE } }, select: { qty: true } },
      },
    });
    for (const line of deliveryLines) {
      const delivered = num(line.qty);
      const qty = round3(Math.max(0, delivered - line.returnLines.reduce((sum, item) => sum + num(item.qty), 0)));
      if (qty <= 0) continue;
      const amount = money((num(line.amount) * qty) / delivered);
      const rate = rates.get(line.itemId)!;
      const value = num(rate.value);
      lines.push({
        key: line.id,
        deliveryId: line.delivery.id,
        invoiceNumber: line.delivery.number,
        deliveryDate: fromDbDate(line.delivery.deliveryDate),
        salesPersonName: commission.salesPerson.name,
        customerName: line.delivery.customer.name,
        itemCode: line.item.code,
        itemName: line.item.name,
        qty,
        amount,
        basis: rate.basis,
        rate: value,
        commission: money(rate.basis === "AMOUNT" ? qty * value : (amount * value) / 100),
        commissionName: commission.name,
      });
    }
  }
  lines.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.invoiceNumber.localeCompare(b.invoiceNumber));

  const summary = new Map<string, { key: string; name: string; qty: number; amount: number; commission: number }>();
  for (const line of lines) {
    const name = query.viewBy === "ITEM" ? `${line.itemCode} - ${line.itemName}` : line.salesPersonName;
    let row = summary.get(name);
    if (!row) summary.set(name, (row = { key: name, name, qty: 0, amount: 0, commission: 0 }));
    row.qty = round3(row.qty + line.qty);
    row.amount = money(row.amount + line.amount);
    row.commission = money(row.commission + line.commission);
  }
  return {
    lines,
    summary: [...summary.values()].sort((a, b) => b.commission - a.commission),
    totalCommission: money(lines.reduce((sum, line) => sum + line.commission, 0)),
  };
}
