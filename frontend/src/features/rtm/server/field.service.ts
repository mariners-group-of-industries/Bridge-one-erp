import { z } from "zod";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { decideWithPipeline } from "@/lib/approval/engine";
import { db } from "@/lib/prisma/client";
import { salesForceScope, territoryFilters } from "./territory.service";
import { DATE, MONTH, actorName, dateRange, documentNumber, fromDbDate, num, requireDistributor, requireEmployee, requireOutlet, toDbDate, unitIds } from "./common";
import { getSettings } from "./masters.service";

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optUuid = z.preprocess((v) => (v === "" ? undefined : v), z.guid().optional());
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
  employeeId: z.guid(),
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
  employeeId: z.guid("Select the sales representative."),
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

// ── Monthly tour plan (TSMs) ─────────────────────────────────────────────────

/** A Territory Sales Manager: designation says so, or assigned on the Territory layer of the Sales Territory tree. */
const TSM_DESIGNATION = /\b(tsm|territory\s+sales\s+manager)\b/i;

export async function tourPlanTsms(actor: Actor) {
  const units = await unitIds(actor);
  const [byDesignation, onTerritory] = await Promise.all([
    db().employee.findMany({
      where: { isActive: true, office: { businessUnitId: { in: units } }, OR: [{ designation: { contains: "TSM", mode: "insensitive" } }, { designation: { contains: "Territory Sales Manager", mode: "insensitive" } }] },
      select: { id: true, employeeCode: true, name: true, designation: true },
    }),
    db().salesTerritoryEmployee.findMany({
      where: { employee: { isActive: true }, node: { businessUnitId: { in: units }, layer: { isTerritory: true } } },
      select: { node: { select: { name: true } }, employee: { select: { id: true, employeeCode: true, name: true, designation: true } } },
    }),
  ]);
  const tsms = new Map<string, { id: string; code: string; name: string; designation: string | null; territories: string[] }>();
  for (const e of byDesignation.filter((x) => TSM_DESIGNATION.test(x.designation ?? ""))) tsms.set(e.id, { id: e.id, code: e.employeeCode, name: e.name, designation: e.designation, territories: [] });
  for (const a of onTerritory) {
    const e = a.employee;
    const entry = tsms.get(e.id) ?? { id: e.id, code: e.employeeCode, name: e.name, designation: e.designation, territories: [] };
    entry.territories.push(a.node.name);
    tsms.set(e.id, entry);
  }
  return [...tsms.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const monthRange = (year: number, month: number) => ({ gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) });

/** The TSM's month: every day with its SR-calendar type and saved plan, plus the points (nodes under the TSM's areas) to choose from. */
export async function tourPlanMonth(actor: Actor, q: { employeeId?: string; year?: string; month?: string }) {
  const parsed = z.object({ employeeId: z.guid("Select the employee."), year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12) }).safeParse(q);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Select the employee, month and year.");
  const { employeeId, year, month } = parsed.data;
  await requireEmployee(actor, employeeId);
  const units = await unitIds(actor);
  const range = monthRange(year, month);
  const [calendar, plans, assigned, nodes] = await Promise.all([
    db().rtmSrCalendarDay.findMany({ where: { employeeId, day: range }, select: { day: true, dayType: true, remarks: true } }),
    db().rtmTourPlan.findMany({ where: { employeeId, planDate: range }, include: { point: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db().salesTerritoryEmployee.findMany({ where: { employeeId }, select: { nodeId: true } }),
    db().salesTerritoryNode.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { id: true, name: true, parentId: true, layer: { select: { name: true, level: true } } } }),
  ]);
  // Points: everything under the nodes the TSM is assigned to (all nodes below the territory layer when unassigned).
  const children = new Map<string, typeof nodes>();
  for (const n of nodes) if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  const under = new Set<string>();
  const walk = (id: string) => {
    for (const c of children.get(id) ?? []) {
      if (under.has(c.id)) continue;
      under.add(c.id);
      walk(c.id);
    }
  };
  for (const a of assigned) walk(a.nodeId);
  const points = (assigned.length ? nodes.filter((n) => under.has(n.id)) : nodes)
    .map((n) => ({ id: n.id, name: n.name, layer: n.layer.name, level: n.layer.level }))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const dayType = new Map(calendar.map((c) => [fromDbDate(c.day), c]));
  const planBy = new Map(plans.map((p) => [fromDbDate(p.planDate), p]));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: last }, (_, i) => {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    const p = planBy.get(date);
    const c = dayType.get(date);
    return {
      date,
      dayType: c?.dayType ?? null,
      dayRemarks: c?.remarks ?? null,
      plan: p
        ? { id: p.id, priority: p.priority, activity: p.activity ?? p.purpose, pointNodeId: p.pointNodeId, point: p.point?.name ?? null, startTime: p.startTime, endTime: p.endTime, remarks: p.remarks, status: p.status, approvedBy: p.approvedBy }
        : null,
    };
  });
  return { days, points };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const optTime = z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(TIME, "Use HH:mm times.").optional());
const monthPlanSchema = z.object({
  employeeId: z.guid("Select the employee."),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  days: z
    .array(
      z.object({
        date: z.string().regex(DATE),
        priority: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["HIGH", "MEDIUM", "LOW"]).optional()),
        activity: z.string().trim().min(1, "Choose the activity.").max(60),
        pointNodeId: optUuid,
        startTime: optTime,
        endTime: optTime,
        remarks: text(300),
      }),
    )
    .max(31),
});

/**
 * Saves the month: days not yet approved are replaced by the rows sent (each
 * PENDING for approval); approved days are kept as they are.
 */
export async function saveTourPlanMonth(actor: Actor, raw: unknown) {
  const input = monthPlanSchema.parse(raw);
  await requireEmployee(actor, input.employeeId);
  const unit = await employeeUnit(input.employeeId);
  const units = await unitIds(actor);
  const ym = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const dates = new Set<string>();
  for (const d of input.days) {
    if (!d.date.startsWith(ym)) throw badRequest(`${d.date} is not in ${ym}.`);
    if (dates.has(d.date)) throw badRequest(`${d.date} appears twice.`);
    dates.add(d.date);
    if (d.startTime && d.endTime && d.endTime <= d.startTime) throw badRequest(`${d.date}: the end time must be after the start time.`);
  }
  const pointIds = [...new Set(input.days.map((d) => d.pointNodeId).filter((x): x is string => !!x))];
  if (pointIds.length && (await db().salesTerritoryNode.count({ where: { id: { in: pointIds }, businessUnitId: { in: units } } })) !== pointIds.length) throw badRequest("Some points are not in your sales territory.");
  const range = monthRange(input.year, input.month);
  await db().$transaction(async (tx) => {
    const kept = await tx.rtmTourPlan.findMany({ where: { employeeId: input.employeeId, planDate: range, status: { in: ["APPROVED", "COMPLETED"] } }, select: { planDate: true } });
    const locked = new Set(kept.map((k) => fromDbDate(k.planDate)));
    await tx.rtmTourPlan.deleteMany({ where: { employeeId: input.employeeId, planDate: range, status: { notIn: ["APPROVED", "COMPLETED"] } } });
    const rows = input.days.filter((d) => !locked.has(d.date));
    if (rows.length) {
      await tx.rtmTourPlan.createMany({
        data: rows.map((d) => ({
          businessUnitId: unit,
          employeeId: input.employeeId,
          planDate: toDbDate(d.date),
          priority: d.priority ?? null,
          activity: d.activity,
          purpose: d.activity,
          pointNodeId: d.pointNodeId ?? null,
          startTime: d.startTime ?? null,
          endTime: d.endTime ?? null,
          remarks: d.remarks ?? null,
          createdBy: actorName(actor),
        })),
      });
    }
  });
  return tourPlanMonth(actor, { employeeId: input.employeeId, year: String(input.year), month: String(input.month) });
}

// ── Sales layer transfer ─────────────────────────────────────────────────────

/** Sales Territory nodes with their layer, parent, child count and directly assigned employees. */
export async function salesLayers(actor: Actor) {
  const units = await unitIds(actor);
  const nodes = await db().salesTerritoryNode.findMany({
    where: { businessUnitId: { in: units }, isActive: true },
    include: {
      layer: { select: { name: true, level: true } },
      parent: { select: { name: true } },
      employees: { include: { employee: { select: { id: true, name: true, employeeCode: true } } } },
      _count: { select: { children: true } },
    },
    orderBy: [{ layer: { level: "asc" } }, { name: "asc" }],
  });
  return nodes.map((n) => ({
    id: n.id,
    code: n.code,
    name: n.name,
    layerId: n.layerId,
    layer: n.layer.name,
    level: n.layer.level,
    parentId: n.parentId,
    parent: n.parent?.name ?? null,
    children: n._count.children,
    employees: n.employees.map((e) => ({ id: e.employee.id, code: e.employee.employeeCode, name: e.employee.name, channel: e.distributionChannel })),
  }));
}

// ── Sales Layer Transfer (recorded, applied once approved) ───────────────────

const layerTransferSchema = z.object({
  type: z.enum(["EMPLOYEE", "AREA"]),
  sourceNodeId: z.guid("Select the source."),
  destinationNodeId: z.guid("Select the destination."),
  employeeId: optUuid,
  remarks: text(500),
});

const nodeRef = { select: { code: true, name: true, parent: { select: { name: true } } } } as const;

export async function listLayerTransfers(actor: Actor, f: { status?: string; layerLevel?: string; type?: string; from?: string; to?: string } = {}) {
  const units = await unitIds(actor);
  const level = f.layerLevel && /^\d+$/.test(f.layerLevel) ? Number(f.layerLevel) : undefined;
  const rows = await db().rtmLayerTransfer.findMany({
    where: {
      businessUnitId: { in: units },
      ...(f.status ? { status: f.status as never } : {}),
      ...(f.type === "EMPLOYEE" || f.type === "AREA" ? { type: f.type } : {}),
      ...(level !== undefined ? { layer: { level } } : {}),
      ...(f.from || f.to ? { transferDate: dateRange(f.from, f.to) } : {}),
    },
    include: { layer: { select: { name: true } }, sourceNode: nodeRef, destinationNode: nodeRef, employee: { select: { employeeCode: true, name: true } } },
    orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });
  const label = (n: { code: string; name: string; parent: { name: string } | null }) => ({ code: n.code, name: n.name, parent: n.parent?.name ?? null });
  return rows.map((t) => ({
    id: t.id,
    number: t.number,
    transferDate: fromDbDate(t.transferDate),
    type: t.type,
    layer: t.layer.name,
    source: label(t.sourceNode),
    destination: label(t.destinationNode),
    employee: t.employee ? `${t.employee.employeeCode} · ${t.employee.name}` : null,
    remarks: t.remarks,
    status: t.status,
    requestedBy: t.requestedBy,
    approvedBy: t.approvedBy,
    appliedAt: t.appliedAt?.toISOString() ?? null,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

/** Raises a transfer (PENDING). Nothing moves until it is approved. */
export async function createLayerTransfer(actor: Actor, raw: unknown) {
  const input = layerTransferSchema.parse(raw);
  if (input.sourceNodeId === input.destinationNodeId) throw badRequest("Choose a different destination.");
  const units = await unitIds(actor);
  const [source, destination] = await Promise.all(
    [input.sourceNodeId, input.destinationNodeId].map((id) =>
      db().salesTerritoryNode.findFirst({ where: { id, businessUnitId: { in: units } }, select: { id: true, name: true, layerId: true, businessUnitId: true, _count: { select: { children: true } } } }),
    ),
  );
  if (!source || !destination) throw notFound("Layer node");
  if (source.layerId !== destination.layerId) throw badRequest("Source and destination must be on the same layer.");
  if (input.type === "EMPLOYEE") {
    if (!input.employeeId) throw badRequest("Select the employee to move.");
    const on = await db().salesTerritoryEmployee.findUnique({ where: { nodeId_employeeId: { nodeId: source.id, employeeId: input.employeeId } } });
    if (!on) throw badRequest(`The employee is not assigned to ${source.name}.`);
  } else if (source._count.children === 0) {
    throw badRequest(`${source.name} has nothing under it to move.`);
  }
  const open = await db().rtmLayerTransfer.count({
    where: { sourceNodeId: source.id, status: "PENDING", type: input.type, ...(input.type === "EMPLOYEE" ? { employeeId: input.employeeId } : {}) },
  });
  if (open) throw badRequest("The same transfer is already waiting for approval.");
  const date = new Date().toISOString().slice(0, 10);
  await db().$transaction(async (tx) => {
    await tx.rtmLayerTransfer.create({
      data: {
        businessUnitId: source.businessUnitId,
        number: await documentNumber(tx, source.businessUnitId, "LAYER_TRANSFER", date),
        transferDate: toDbDate(date),
        type: input.type,
        layerId: source.layerId,
        sourceNodeId: source.id,
        destinationNodeId: destination.id,
        employeeId: input.type === "EMPLOYEE" ? (input.employeeId ?? null) : null,
        remarks: input.remarks ?? null,
        requestedBy: actorName(actor),
      },
    });
  });
  return listLayerTransfers(actor);
}

/** Approve / reject. The last approval applies the move. */
export async function reviewLayerTransfer(actor: Actor, id: string, decision: "approve" | "reject") {
  const units = await unitIds(actor);
  const t = await db().rtmLayerTransfer.findFirst({ where: { id, businessUnitId: { in: units } }, include: { sourceNode: { select: { name: true } } } });
  if (!t) throw notFound("Transfer");
  if (t.status !== "PENDING") throw badRequest(`${t.number} is already ${t.status.toLowerCase()}.`);
  await decideWithPipeline(actor, { feature: "Sales Layer Transfer", documentId: id, businessUnitId: t.businessUnitId }, decision, async (tx) => {
    if (decision === "reject") {
      await tx.rtmLayerTransfer.update({ where: { id }, data: { status: "REJECTED", approvedBy: actorName(actor) } });
      return;
    }
    if (t.type === "EMPLOYEE") {
      const current = t.employeeId ? await tx.salesTerritoryEmployee.findUnique({ where: { nodeId_employeeId: { nodeId: t.sourceNodeId, employeeId: t.employeeId } } }) : null;
      if (!current) throw badRequest(`The employee is no longer on ${t.sourceNode.name}; reject this transfer instead.`);
      await tx.salesTerritoryEmployee.delete({ where: { id: current.id } });
      await tx.salesTerritoryEmployee.upsert({
        where: { nodeId_employeeId: { nodeId: t.destinationNodeId, employeeId: current.employeeId } },
        create: { nodeId: t.destinationNodeId, employeeId: current.employeeId, distributionChannel: current.distributionChannel },
        update: {},
      });
    } else {
      await tx.salesTerritoryNode.updateMany({ where: { parentId: t.sourceNodeId }, data: { parentId: t.destinationNodeId } });
    }
    await tx.rtmLayerTransfer.update({ where: { id }, data: { status: "COMPLETED", approvedBy: actorName(actor), appliedAt: new Date() } });
  });
  return listLayerTransfers(actor);
}

// ── Visits: employee and outlet tracking ─────────────────────────────────────

const visitSchema = z.object({
  employeeId: z.guid("Select the employee."),
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

/**
 * Employee wise tracking: the sales force covering a territory node (or all of
 * it), each with the time, place and outlet of their latest field activity.
 */
export async function employeeLastActivity(actor: Actor, f: { nodeId?: string; srId?: string } = {}) {
  const units = await unitIds(actor);
  const [scope, { salesForce }] = await Promise.all([salesForceScope(actor, f), territoryFilters(actor)]);
  const known = new Map(salesForce.map((s) => [s.id, s]));
  // Without a filter, anyone with field activity shows too.
  const active = scope
    ? []
    : await db().rtmVisit.findMany({ where: { businessUnitId: { in: units }, employeeId: { notIn: [...known.keys()] } }, distinct: ["employeeId"], select: { employeeId: true } });
  const ids = scope ?? [...known.keys(), ...active.map((v) => v.employeeId)];
  if (!ids.length) return [];
  const [employees, last] = await Promise.all([
    db().employee.findMany({ where: { id: { in: ids }, office: { businessUnitId: { in: units } } }, select: { id: true, employeeCode: true, name: true, designation: true } }),
    db().rtmVisit.findMany({
      where: { employeeId: { in: ids }, businessUnitId: { in: units } },
      distinct: ["employeeId"],
      orderBy: { visitedAt: "desc" },
      select: { employeeId: true, kind: true, visitedAt: true, latitude: true, longitude: true, outlet: { select: { code: true, name: true } } },
    }),
  ]);
  const lastBy = new Map(last.map((v) => [v.employeeId, v]));
  // The latest activity that carried a location (a visit may be logged without one).
  const located = await db().rtmVisit.findMany({
    where: { employeeId: { in: ids }, businessUnitId: { in: units }, latitude: { not: null }, longitude: { not: null } },
    distinct: ["employeeId"],
    orderBy: { visitedAt: "desc" },
    select: { employeeId: true, visitedAt: true, latitude: true, longitude: true, outlet: { select: { code: true, name: true } } },
  });
  const placeBy = new Map(located.map((v) => [v.employeeId, v]));
  return employees
    .map((e) => {
      const v = lastBy.get(e.id);
      const p = placeBy.get(e.id);
      return {
        employeeId: e.id,
        code: e.employeeCode,
        name: e.name,
        designation: e.designation,
        lastActivityAt: v?.visitedAt.toISOString() ?? null,
        lastActivity: v?.kind ?? null,
        location: p ? { latitude: num(p.latitude), longitude: num(p.longitude), at: p.visitedAt.toISOString(), outlet: p.outlet ? `${p.outlet.code} · ${p.outlet.name}` : null } : null,
      };
    })
    .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") || a.name.localeCompare(b.name));
}

/**
 * Area wise tracking: one row per area one layer below `nodeId` (the top layer
 * when nothing is picked; the area itself when it has nothing below), with the
 * sales force covering it, how many were active today and the latest activity.
 */
export async function areaActivity(actor: Actor, f: { nodeId?: string; srId?: string } = {}) {
  const units = await unitIds(actor);
  const { layers, salesForce } = await territoryFilters(actor);
  const all = layers.flatMap((l) => l.nodes.map((n) => ({ ...n, layer: l.name })));
  const picked = f.nodeId ? all.find((n) => n.id === f.nodeId) : undefined;
  if (f.nodeId && !picked) throw badRequest("Unknown area.");
  let areas = picked ? all.filter((n) => n.path.length === picked.path.length + 1 && n.path[picked.path.length - 1] === picked.id) : (layers[0]?.nodes.map((n) => ({ ...n, layer: layers[0].name })) ?? []);
  if (picked && !areas.length) areas = [picked];
  const people = f.srId ? salesForce.filter((s) => s.id === f.srId) : salesForce;
  const ids = [...new Set(people.map((p) => p.id))];
  const [last, today] = ids.length
    ? await Promise.all([
        db().rtmVisit.findMany({
          where: { employeeId: { in: ids }, businessUnitId: { in: units } },
          distinct: ["employeeId"],
          orderBy: { visitedAt: "desc" },
          select: { employeeId: true, visitedAt: true, latitude: true, longitude: true, employee: { select: { name: true } }, outlet: { select: { code: true, name: true } } },
        }),
        db().rtmVisit.findMany({ where: { employeeId: { in: ids }, businessUnitId: { in: units }, visitedAt: dayBounds(new Date().toISOString().slice(0, 10)) }, distinct: ["employeeId"], select: { employeeId: true } }),
      ])
    : [[], []];
  const lastBy = new Map(last.map((v) => [v.employeeId, v]));
  const activeToday = new Set(today.map((v) => v.employeeId));
  const byId = new Map(all.map((n) => [n.id, n]));
  return areas.map((a) => {
    const covering = people.filter((p) => p.nodeIds.includes(a.id));
    const latest = covering.map((p) => lastBy.get(p.id)).filter((v) => !!v).sort((x, y) => y.visitedAt.getTime() - x.visitedAt.getTime())[0];
    const parentId = a.path.at(-2);
    return {
      nodeId: a.id,
      code: a.code,
      name: a.name,
      layer: a.layer,
      parent: parentId ? (byId.get(parentId)?.name ?? null) : null,
      salesForce: covering.length,
      activeToday: covering.filter((p) => activeToday.has(p.id)).length,
      lastActivityAt: latest?.visitedAt.toISOString() ?? null,
      lastBy: latest?.employee.name ?? null,
      location:
        latest && latest.latitude !== null && latest.longitude !== null
          ? { latitude: num(latest.latitude), longitude: num(latest.longitude), outlet: latest.outlet ? `${latest.outlet.code} · ${latest.outlet.name}` : null }
          : null,
    };
  });
}
