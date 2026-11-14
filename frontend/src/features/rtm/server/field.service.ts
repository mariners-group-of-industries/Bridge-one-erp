import { z } from "zod";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { decideWithPipeline } from "@/lib/approval/engine";
import { db } from "@/lib/prisma/client";
import { DATE, MONTH, actorName, dateRange, fromDbDate, num, requireDistributor, requireEmployee, requireOutlet, toDbDate, unitIds } from "./common";
import { getSettings } from "./masters.service";

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optUuid = z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional());
const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_TYPES = ["WORKING", "WEEKEND", "HOLIDAY", "LEAVE"] as const;

async function employeeUnit(employeeId: string) {
  const e = await db().employee.findUniqueOrThrow({ where: { id: employeeId }, select: { office: { select: { businessUnitId: true } } } });
  return e.office.businessUnitId;
}

// ── SR calendar ──────────────────────────────────────────────────────────────

/** Every day of the month with its type: saved, or WORKING / WEEKEND from the weekly holiday. */
export async function getCalendar(actor: Actor, employeeId: string, month: string) {
  if (!MONTH.test(month)) throw badRequest("Use a YYYY-MM month.");
  await requireEmployee(actor, employeeId);
  const unit = await employeeUnit(employeeId);
  const weekly = (await getSettings(unit)).weeklyHoliday;
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const saved = await db().rtmSrCalendarDay.findMany({ where: { employeeId, day: { gte: toDbDate(`${month}-01`), lte: toDbDate(`${month}-${String(days).padStart(2, "0")}`) } } });
  const byDay = new Map(saved.map((d) => [fromDbDate(d.day), d]));
  return Array.from({ length: days }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    const weekday = DAY_NAMES[new Date(`${day}T00:00:00Z`).getUTCDay()];
    const s = byDay.get(day);
    return { day, weekday, dayType: s?.dayType ?? (weekday === weekly ? "WEEKEND" : "WORKING"), remarks: s?.remarks ?? "", saved: !!s };
  });
}

const calendarSchema = z.object({
  employeeId: z.uuid(),
  month: z.string().regex(MONTH),
  days: z.array(z.object({ day: z.string().regex(DATE), dayType: z.enum(DAY_TYPES), remarks: text(200) })).max(31),
});

export async function saveCalendar(actor: Actor, raw: unknown) {
  const input = calendarSchema.parse(raw);
  await requireEmployee(actor, input.employeeId);
  const unit = await employeeUnit(input.employeeId);
  if (input.days.some((d) => !d.day.startsWith(input.month))) throw badRequest("All days must be in the chosen month.");
  await db().$transaction(
    input.days.map((d) =>
      db().rtmSrCalendarDay.upsert({
        where: { employeeId_day: { employeeId: input.employeeId, day: toDbDate(d.day) } },
        create: { businessUnitId: unit, employeeId: input.employeeId, day: toDbDate(d.day), dayType: d.dayType, remarks: d.remarks ?? null },
        update: { dayType: d.dayType, remarks: d.remarks ?? null },
      }),
    ),
  );
  return getCalendar(actor, input.employeeId, input.month);
}

// ── Tour plans ───────────────────────────────────────────────────────────────

const tourSchema = z.object({
  employeeId: z.uuid("Select the sales representative."),
  planDate: z.string().regex(DATE),
  routeId: optUuid,
  distributorId: optUuid,
  purpose: text(300),
});

export async function listTourPlans(actor: Actor, f: { from?: string; to?: string; employeeId?: string } = {}) {
  const units = await unitIds(actor);
  const rows = await db().rtmTourPlan.findMany({
    where: { businessUnitId: { in: units }, ...(f.from || f.to ? { planDate: dateRange(f.from, f.to) } : {}), ...(f.employeeId ? { employeeId: f.employeeId } : {}) },
    include: { employee: { select: { name: true, employeeCode: true } }, route: { select: { name: true } }, distributor: { select: { name: true } } },
    orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  return rows.map((t) => ({
    id: t.id,
    planDate: fromDbDate(t.planDate),
    employeeId: t.employeeId,
    employee: `${t.employee.employeeCode} · ${t.employee.name}`,
    route: t.route?.name ?? null,
    distributor: t.distributor?.name ?? null,
    purpose: t.purpose,
    status: t.status,
    createdBy: t.createdBy,
    approvedBy: t.approvedBy,
    updatedAt: t.createdAt.toISOString(),
  }));
}

export async function createTourPlan(actor: Actor, raw: unknown) {
  const input = tourSchema.parse(raw);
  await requireEmployee(actor, input.employeeId);
  const unit = await employeeUnit(input.employeeId);
  if (input.distributorId) await requireDistributor(actor, input.distributorId);
  if (input.routeId && !(await db().salesArea.findFirst({ where: { id: input.routeId, kind: "ROUTE", businessUnitId: unit } }))) throw badRequest("Select a route of this business unit.");
  const day = await db().rtmSrCalendarDay.findUnique({ where: { employeeId_day: { employeeId: input.employeeId, day: toDbDate(input.planDate) } } });
  if (day && (day.dayType === "HOLIDAY" || day.dayType === "LEAVE")) throw badRequest(`${input.planDate} is a ${day.dayType.toLowerCase()} in the SR calendar.`);
  await db().rtmTourPlan.create({
    data: { businessUnitId: unit, employeeId: input.employeeId, planDate: toDbDate(input.planDate), routeId: input.routeId ?? null, distributorId: input.distributorId ?? null, purpose: input.purpose ?? null, createdBy: actorName(actor) },
  });
  return listTourPlans(actor);
}

export async function reviewTourPlan(actor: Actor, id: string, decision: "approve" | "reject") {
  const units = await unitIds(actor);
  const t = await db().rtmTourPlan.findFirst({ where: { id, businessUnitId: { in: units } } });
  if (!t) throw notFound("Tour plan");
  if (t.status !== "PENDING") throw badRequest(`This tour plan is already ${t.status.toLowerCase()}.`);
  // Multilayer approval: stays PENDING until the last pipeline stage approves.
  await decideWithPipeline(actor, { feature: "Tour Plan", documentId: id, businessUnitId: t.businessUnitId }, decision, async (tx) => {
    await tx.rtmTourPlan.update({ where: { id }, data: { status: decision === "approve" ? "APPROVED" : "REJECTED", approvedBy: actorName(actor) } });
  });
  return listTourPlans(actor);
}

// ── Sales layer transfer ─────────────────────────────────────────────────────

/** Sales territory layers (Sales › Setup) with the employees placed on each node. */
export async function salesLayers(actor: Actor) {
  const units = await unitIds(actor);
  const nodes = await db().salesTerritoryNode.findMany({
    where: { businessUnitId: { in: units }, isActive: true },
    include: { layer: { select: { name: true, level: true } }, parent: { select: { name: true } }, employees: { include: { employee: { select: { id: true, name: true, employeeCode: true } } } } },
    orderBy: [{ layer: { level: "asc" } }, { name: "asc" }],
  });
  return nodes.map((n) => ({
    id: n.id,
    code: n.code,
    name: n.name,
    layer: n.layer.name,
    level: n.layer.level,
    parent: n.parent?.name ?? null,
    employees: n.employees.map((e) => ({ id: e.employee.id, code: e.employee.employeeCode, name: e.employee.name, channel: e.distributionChannel })),
  }));
}

const layerTransferSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("employee"), employeeId: z.uuid(), fromNodeId: z.uuid(), toNodeId: z.uuid() }),
  z.object({ kind: z.literal("outlets"), outletIds: z.array(z.uuid()).min(1).max(500), routeId: z.uuid(), distributorId: optUuid }),
]);

/** Moves an employee to another layer node, or outlets to another route (and distributor). */
export async function transferLayer(actor: Actor, raw: unknown) {
  const input = layerTransferSchema.parse(raw);
  const units = await unitIds(actor);
  if (input.kind === "employee") {
    if (input.fromNodeId === input.toNodeId) throw badRequest("Choose a different node to move to.");
    const [from, to] = await Promise.all(
      [input.fromNodeId, input.toNodeId].map((id) => db().salesTerritoryNode.findFirst({ where: { id, businessUnitId: { in: units } }, select: { id: true, layerId: true, name: true } })),
    );
    if (!from || !to) throw notFound("Layer node");
    if (from.layerId !== to.layerId) throw badRequest("Move within the same layer.");
    const current = await db().salesTerritoryEmployee.findUnique({ where: { nodeId_employeeId: { nodeId: from.id, employeeId: input.employeeId } } });
    if (!current) throw badRequest(`The employee is not on ${from.name}.`);
    await db().$transaction([
      db().salesTerritoryEmployee.delete({ where: { id: current.id } }),
      db().salesTerritoryEmployee.upsert({
        where: { nodeId_employeeId: { nodeId: to.id, employeeId: input.employeeId } },
        create: { nodeId: to.id, employeeId: input.employeeId, distributionChannel: current.distributionChannel },
        update: {},
      }),
    ]);
  } else {
    const outlets = await db().rtmOutlet.findMany({ where: { id: { in: input.outletIds }, businessUnitId: { in: units } }, select: { id: true, businessUnitId: true } });
    if (outlets.length !== input.outletIds.length) throw notFound("Outlet");
    const unit = outlets[0].businessUnitId;
    if (outlets.some((o) => o.businessUnitId !== unit)) throw badRequest("Move outlets of one business unit at a time.");
    if (!(await db().salesArea.findFirst({ where: { id: input.routeId, kind: "ROUTE", businessUnitId: unit } }))) throw badRequest("Select a route of this business unit.");
    if (input.distributorId && (await requireDistributor(actor, input.distributorId)).businessUnitId !== unit) throw badRequest("The distributor is in another business unit.");
    await db().rtmOutlet.updateMany({ where: { id: { in: input.outletIds } }, data: { routeId: input.routeId, ...(input.distributorId ? { distributorId: input.distributorId } : {}) } });
  }
  return salesLayers(actor);
}

// ── Visits: employee and outlet tracking ─────────────────────────────────────

const visitSchema = z.object({
  employeeId: z.uuid("Select the employee."),
  kind: z.enum(["CHECK_IN", "VISIT", "CHECK_OUT"]),
  outletId: optUuid,
  visitedAt: z.iso.datetime({ offset: true }).optional(),
  latitude: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
  longitude: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
  remarks: text(300),
});

/** Records a check-in, outlet visit or check-out (from the field app or by hand). */
export async function recordVisit(actor: Actor, raw: unknown) {
  const input = visitSchema.parse(raw);
  await requireEmployee(actor, input.employeeId);
  if (input.kind === "VISIT" && !input.outletId) throw badRequest("Select the outlet visited.");
  if (input.outletId) await requireOutlet(actor, input.outletId);
  await db().rtmVisit.create({
    data: {
      businessUnitId: await employeeUnit(input.employeeId),
      employeeId: input.employeeId,
      outletId: input.outletId ?? null,
      kind: input.kind,
      visitedAt: input.visitedAt ? new Date(input.visitedAt) : new Date(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      remarks: input.remarks ?? null,
      createdBy: actorName(actor),
    },
  });
}

const dayBounds = (date: string) => ({ gte: new Date(`${date}T00:00:00.000Z`), lt: new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 86_400_000) });

/** Each employee's day: check-in / out, visits, last location, late flag. */
export async function employeeTracking(actor: Actor, date: string, employeeId?: string) {
  if (!DATE.test(date)) throw badRequest("Choose a date.");
  const units = await unitIds(actor);
  const visits = await db().rtmVisit.findMany({
    where: { businessUnitId: { in: units }, visitedAt: dayBounds(date), ...(employeeId ? { employeeId } : {}) },
    include: { employee: { select: { name: true, employeeCode: true, office: { select: { businessUnitId: true } } } }, outlet: { select: { name: true, code: true } } },
    orderBy: { visitedAt: "asc" },
  });
  const settings = new Map<string, string>();
  for (const unit of new Set(visits.map((v) => v.employee.office.businessUnitId))) settings.set(unit, (await getSettings(unit)).workStartTime);
  const byEmployee = new Map<string, typeof visits>();
  for (const v of visits) byEmployee.set(v.employeeId, [...(byEmployee.get(v.employeeId) ?? []), v]);
  const time = (d: Date) => d.toISOString().slice(11, 16);
  const summary = [...byEmployee.values()].map((list) => {
    const e = list[0].employee;
    const checkIn = list.find((v) => v.kind === "CHECK_IN");
    const checkOut = [...list].reverse().find((v) => v.kind === "CHECK_OUT");
    const located = [...list].reverse().find((v) => v.latitude !== null);
    const start = settings.get(e.office.businessUnitId) ?? "09:00";
    return {
      employeeId: list[0].employeeId,
      employee: `${e.employeeCode} · ${e.name}`,
      checkIn: checkIn ? time(checkIn.visitedAt) : null,
      checkOut: checkOut ? time(checkOut.visitedAt) : null,
      late: !!checkIn && time(checkIn.visitedAt) > start,
      visits: list.filter((v) => v.kind === "VISIT").length,
      outletsVisited: new Set(list.filter((v) => v.outletId).map((v) => v.outletId)).size,
      lastLocation: located ? { latitude: num(located.latitude), longitude: num(located.longitude), at: time(located.visitedAt) } : null,
    };
  });
  return {
    summary,
    visits: visits.map((v) => ({
      id: v.id,
      employee: `${v.employee.employeeCode} · ${v.employee.name}`,
      kind: v.kind,
      time: time(v.visitedAt),
      outlet: v.outlet ? `${v.outlet.code} · ${v.outlet.name}` : null,
      latitude: v.latitude === null ? null : num(v.latitude),
      longitude: v.longitude === null ? null : num(v.longitude),
      remarks: v.remarks,
    })),
  };
}

/** Each outlet in a period: visits, orders, last visit / order (coverage). */
export async function outletTracking(actor: Actor, from: string, to: string) {
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw badRequest("Choose a valid date range.");
  const units = await unitIds(actor);
  const range = { gte: new Date(`${from}T00:00:00.000Z`), lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) };
  const [outlets, visits, orders] = await Promise.all([
    db().rtmOutlet.findMany({ where: { businessUnitId: { in: units }, isActive: true }, include: { distributor: { select: { name: true } }, route: { select: { name: true } } }, orderBy: { code: "asc" } }),
    db().rtmVisit.groupBy({ by: ["outletId"], where: { businessUnitId: { in: units }, kind: "VISIT", visitedAt: range, outletId: { not: null } }, _count: { _all: true }, _max: { visitedAt: true } }),
    db().rtmOrder.groupBy({ by: ["outletId"], where: { businessUnitId: { in: units }, status: { not: "CANCELLED" }, orderDate: dateRange(from, to) }, _count: { _all: true }, _sum: { total: true }, _max: { orderDate: true } }),
  ]);
  const v = new Map(visits.map((x) => [x.outletId!, x]));
  const o = new Map(orders.map((x) => [x.outletId, x]));
  return outlets.map((outlet) => ({
    id: outlet.id,
    outlet: `${outlet.code} · ${outlet.name}`,
    distributor: outlet.distributor.name,
    route: outlet.route?.name ?? null,
    latitude: outlet.latitude === null ? null : num(outlet.latitude),
    longitude: outlet.longitude === null ? null : num(outlet.longitude),
    visits: v.get(outlet.id)?._count._all ?? 0,
    lastVisit: v.get(outlet.id)?._max.visitedAt?.toISOString().slice(0, 16).replace("T", " ") ?? null,
    orders: o.get(outlet.id)?._count._all ?? 0,
    orderValue: num(o.get(outlet.id)?._sum.total),
    lastOrder: o.get(outlet.id)?._max.orderDate ? fromDbDate(o.get(outlet.id)!._max.orderDate!) : null,
  }));
}
