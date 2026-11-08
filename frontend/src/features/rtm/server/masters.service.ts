import { z } from "zod";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { DATE, MONTH, actorName, fromDbDate, num, requireDistributor, requireEmployee, toDbDate, unitIds } from "./common";

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const uuid = z.uuid();
const optUuid = z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional());
const optNum = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().finite().min(0).optional());

// ── Settings ─────────────────────────────────────────────────────────────────

/** RTM settings and their defaults (Configuration page). */
export const RTM_SETTINGS = {
  outletCodePrefix: { label: "Outlet code prefix", default: "OUT-", hint: "New outlets are numbered with this prefix." },
  allowDirectDelivery: { label: "Allow direct delivery", default: "true", hint: "Deliveries without a retail order (true / false)." },
  enforceCreditLimit: { label: "Enforce outlet credit limit", default: "true", hint: "Block deliveries that take an outlet over its credit limit (true / false)." },
  weeklyHoliday: { label: "Weekly holiday", default: "FRIDAY", hint: "Day the SR calendar marks as weekend (MONDAY … SUNDAY)." },
  workStartTime: { label: "Work start time", default: "09:00", hint: "Check-ins after this time are shown as late (HH:MM)." },
} as const;
export type RtmSettingKey = keyof typeof RTM_SETTINGS;

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const settingRules: Record<RtmSettingKey, (v: string) => boolean> = {
  outletCodePrefix: (v) => /^[A-Za-z0-9-]{1,10}$/.test(v),
  allowDirectDelivery: (v) => v === "true" || v === "false",
  enforceCreditLimit: (v) => v === "true" || v === "false",
  weeklyHoliday: (v) => DAYS.includes(v),
  workStartTime: (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
};

export async function getSettings(businessUnitId: string): Promise<Record<RtmSettingKey, string>> {
  const rows = await db().rtmSetting.findMany({ where: { businessUnitId } });
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries((Object.keys(RTM_SETTINGS) as RtmSettingKey[]).map((k) => [k, stored.get(k) ?? RTM_SETTINGS[k].default])) as Record<RtmSettingKey, string>;
}

async function primaryUnit(actor: Actor, businessUnitId?: string) {
  const units = await unitIds(actor);
  const id = businessUnitId && units.includes(businessUnitId) ? businessUnitId : units[0];
  if (!id) throw badRequest("You do not have access to any business unit.");
  return id;
}

export async function readSettings(actor: Actor, businessUnitId?: string) {
  const unit = await primaryUnit(actor, businessUnitId);
  const units = await db().businessUnit.findMany({ where: { id: { in: await unitIds(actor) } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return {
    businessUnitId: unit,
    businessUnits: units,
    settings: await getSettings(unit),
    definitions: Object.entries(RTM_SETTINGS).map(([key, d]) => ({ key, label: d.label, hint: d.hint, default: d.default })),
  };
}

export async function saveSettings(actor: Actor, raw: unknown) {
  const input = z.object({ businessUnitId: uuid, settings: z.record(z.string(), z.string().trim().max(300)) }).parse(raw);
  const unit = await primaryUnit(actor, input.businessUnitId);
  const entries = Object.entries(input.settings).filter((e): e is [RtmSettingKey, string] => e[0] in RTM_SETTINGS);
  for (const [k, v] of entries) if (!settingRules[k](v)) throw badRequest(`${RTM_SETTINGS[k].label}: invalid value "${v}".`);
  await db().$transaction(
    entries.map(([key, value]) =>
      db().rtmSetting.upsert({
        where: { businessUnitId_key: { businessUnitId: unit, key } },
        create: { businessUnitId: unit, key, value, updatedBy: actorName(actor) },
        update: { value, updatedBy: actorName(actor) },
      }),
    ),
  );
  return readSettings(actor, unit);
}

// ── Lookups for forms and filters ────────────────────────────────────────────

export async function lookups(actor: Actor) {
  const units = await unitIds(actor);
  const [distributors, outlets, channels, routes, srs, items] = await Promise.all([
    db().customer.findMany({ where: { businessUnitId: { in: units }, customerType: "DISTRIBUTOR", isActive: true }, select: { id: true, code: true, name: true, businessUnitId: true }, orderBy: { name: "asc" } }),
    db().rtmOutlet.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { id: true, code: true, name: true, distributorId: true, channelId: true, routeId: true }, orderBy: { name: "asc" } }),
    db().rtmChannel.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    db().salesArea.findMany({ where: { businessUnitId: { in: units }, kind: "ROUTE", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().employee.findMany({ where: { office: { businessUnitId: { in: units } }, isActive: true }, select: { id: true, employeeCode: true, name: true, designation: true }, orderBy: { name: "asc" } }),
    db().item.findMany({ where: { businessUnitId: { in: units }, isActive: true }, select: { id: true, code: true, name: true, uom: true, salesRate: true, businessUnitId: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    distributors,
    outlets,
    channels,
    routes,
    srs: srs.map((e) => ({ id: e.id, code: e.employeeCode, name: e.name, designation: e.designation })),
    items: items.map((i) => ({ id: i.id, code: i.code, name: i.name, uom: i.uom, rate: num(i.salesRate), businessUnitId: i.businessUnitId })),
  };
}

// ── Distribution channels ────────────────────────────────────────────────────

const channelSchema = z.object({ code: z.string().trim().min(1).max(20), name: z.string().trim().min(1).max(100), description: text(300), isActive: z.boolean().default(true) });

export async function listChannels(actor: Actor) {
  const units = await unitIds(actor);
  const rows = await db().rtmChannel.findMany({ where: { businessUnitId: { in: units } }, include: { _count: { select: { outlets: true } } }, orderBy: { code: "asc" } });
  return rows.map((c) => ({ id: c.id, code: c.code, name: c.name, description: c.description, isActive: c.isActive, outlets: c._count.outlets, updatedAt: c.updatedAt.toISOString() }));
}

export async function saveChannel(actor: Actor, raw: unknown, id?: string) {
  const input = channelSchema.parse(raw);
  const units = await unitIds(actor);
  if (id) {
    const existing = await db().rtmChannel.findFirst({ where: { id, businessUnitId: { in: units } } });
    if (!existing) throw notFound("Channel");
    await db().rtmChannel.update({ where: { id }, data: input });
  } else {
    await db().rtmChannel.create({ data: { ...input, businessUnitId: await primaryUnit(actor) } });
  }
  return listChannels(actor);
}

// ── Outlets ──────────────────────────────────────────────────────────────────

const outletSchema = z.object({
  name: z.string().trim().min(1, "Enter the outlet name.").max(150),
  ownerName: text(150),
  phone: text(30),
  address: text(300),
  channelId: optUuid,
  distributorId: uuid,
  routeId: optUuid,
  latitude: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
  longitude: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
  creditLimit: optNum,
  isActive: z.boolean().default(true),
});

export async function listOutlets(actor: Actor) {
  const units = await unitIds(actor);
  const rows = await db().rtmOutlet.findMany({
    where: { businessUnitId: { in: units } },
    include: { channel: { select: { name: true } }, distributor: { select: { name: true } }, route: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    ownerName: o.ownerName,
    phone: o.phone,
    address: o.address,
    channelId: o.channelId,
    channel: o.channel?.name ?? null,
    distributorId: o.distributorId,
    distributor: o.distributor.name,
    routeId: o.routeId,
    route: o.route?.name ?? null,
    latitude: o.latitude === null ? null : num(o.latitude),
    longitude: o.longitude === null ? null : num(o.longitude),
    creditLimit: o.creditLimit === null ? null : num(o.creditLimit),
    isActive: o.isActive,
    updatedAt: o.updatedAt.toISOString(),
  }));
}

export async function saveOutlet(actor: Actor, raw: unknown, id?: string) {
  const input = outletSchema.parse(raw);
  const distributor = await requireDistributor(actor, input.distributorId);
  if (input.routeId && !(await db().salesArea.findFirst({ where: { id: input.routeId, kind: "ROUTE", businessUnitId: distributor.businessUnitId } }))) {
    throw badRequest("The route belongs to another business unit.");
  }
  if (input.channelId && !(await db().rtmChannel.findFirst({ where: { id: input.channelId, businessUnitId: distributor.businessUnitId } }))) {
    throw badRequest("The channel belongs to another business unit.");
  }
  if (id) {
    const units = await unitIds(actor);
    const existing = await db().rtmOutlet.findFirst({ where: { id, businessUnitId: { in: units } } });
    if (!existing) throw notFound("Outlet");
    if (existing.businessUnitId !== distributor.businessUnitId) throw badRequest("An outlet cannot move to another business unit's distributor.");
    await db().rtmOutlet.update({ where: { id }, data: { ...input, channelId: input.channelId ?? null, routeId: input.routeId ?? null } });
  } else {
    const prefix = (await getSettings(distributor.businessUnitId)).outletCodePrefix;
    await db().$transaction(async (tx) => {
      const count = await tx.rtmOutlet.count({ where: { businessUnitId: distributor.businessUnitId } });
      await tx.rtmOutlet.create({
        data: { ...input, businessUnitId: distributor.businessUnitId, code: `${prefix}${String(count + 1).padStart(5, "0")}`, createdBy: actorName(actor) },
      });
    });
  }
  return listOutlets(actor);
}

// ── Offers and discounts ─────────────────────────────────────────────────────

const offerSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    channelId: optUuid,
    itemId: optUuid,
    minQty: optNum,
    minAmount: optNum,
    discountPercent: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(0).max(100).optional()),
    discountAmount: optNum,
    validFrom: z.string().regex(DATE),
    validTo: z.string().regex(DATE),
    isActive: z.boolean().default(true),
  })
  .refine((o) => o.validFrom <= o.validTo, { message: "The offer ends before it starts.", path: ["validTo"] })
  .refine((o) => (o.discountPercent ?? 0) > 0 || (o.discountAmount ?? 0) > 0, { message: "Give a discount percent or amount.", path: ["discountPercent"] });

export async function listOffers(actor: Actor) {
  const units = await unitIds(actor);
  const rows = await db().rtmOffer.findMany({
    where: { businessUnitId: { in: units } },
    include: { channel: { select: { name: true } }, item: { select: { name: true } } },
    orderBy: { validFrom: "desc" },
  });
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    channelId: o.channelId,
    channel: o.channel?.name ?? "All channels",
    itemId: o.itemId,
    item: o.item?.name ?? "Whole order",
    minQty: o.minQty === null ? null : num(o.minQty),
    minAmount: o.minAmount === null ? null : num(o.minAmount),
    discountPercent: o.discountPercent === null ? null : num(o.discountPercent),
    discountAmount: o.discountAmount === null ? null : num(o.discountAmount),
    validFrom: fromDbDate(o.validFrom),
    validTo: fromDbDate(o.validTo),
    isActive: o.isActive,
    updatedAt: o.createdAt.toISOString(),
  }));
}

export async function saveOffer(actor: Actor, raw: unknown, id?: string) {
  const input = offerSchema.parse(raw);
  const units = await unitIds(actor);
  const data = { ...input, channelId: input.channelId ?? null, itemId: input.itemId ?? null, validFrom: toDbDate(input.validFrom), validTo: toDbDate(input.validTo) };
  if (id) {
    const existing = await db().rtmOffer.findFirst({ where: { id, businessUnitId: { in: units } } });
    if (!existing) throw notFound("Offer");
    await db().rtmOffer.update({ where: { id }, data });
  } else {
    await db().rtmOffer.create({ data: { ...data, businessUnitId: await primaryUnit(actor), createdBy: actorName(actor) } });
  }
  return listOffers(actor);
}

/**
 * The best active offer for an order: the one giving the largest discount among
 * offers valid on the date whose channel, item and minimums the order meets.
 */
export async function bestOffer(
  businessUnitId: string,
  input: { date: string; channelId: string | null; lines: { itemId: string; qty: number; amount: number }[] },
) {
  const date = toDbDate(input.date);
  const offers = await db().rtmOffer.findMany({ where: { businessUnitId, isActive: true, validFrom: { lte: date }, validTo: { gte: date } } });
  let best: { id: string; name: string; discount: number } | null = null;
  for (const o of offers) {
    if (o.channelId && o.channelId !== input.channelId) continue;
    const lines = o.itemId ? input.lines.filter((l) => l.itemId === o.itemId) : input.lines;
    const qty = lines.reduce((t, l) => t + l.qty, 0);
    const amount = lines.reduce((t, l) => t + l.amount, 0);
    if (!lines.length || qty < num(o.minQty) || amount < num(o.minAmount)) continue;
    const discount = Math.min(amount, Math.round((amount * num(o.discountPercent)) / 100 * 100) / 100 + num(o.discountAmount));
    if (!best || discount > best.discount) best = { id: o.id, name: o.name, discount };
  }
  return best;
}

// ── Targets ──────────────────────────────────────────────────────────────────

const targetSchema = z
  .object({
    month: z.string().regex(MONTH, "Use YYYY-MM."),
    employeeId: optUuid,
    distributorId: optUuid,
    itemId: optUuid,
    targetQty: optNum,
    targetValue: optNum,
  })
  .refine((t) => t.employeeId || t.distributorId, { message: "Choose a sales representative or a distributor.", path: ["employeeId"] })
  .refine((t) => (t.targetQty ?? 0) > 0 || (t.targetValue ?? 0) > 0, { message: "Enter a target quantity or value.", path: ["targetValue"] })
  .refine((t) => !t.targetQty || t.itemId, { message: "A quantity target needs an item.", path: ["itemId"] });

export async function listTargets(actor: Actor, month?: string) {
  const units = await unitIds(actor);
  const rows = await db().rtmTarget.findMany({
    where: { businessUnitId: { in: units }, ...(month ? { month } : {}) },
    include: { employee: { select: { name: true } }, distributor: { select: { name: true } }, item: { select: { name: true } } },
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((t) => ({
    id: t.id,
    month: t.month,
    employeeId: t.employeeId,
    employee: t.employee?.name ?? null,
    distributorId: t.distributorId,
    distributor: t.distributor?.name ?? null,
    itemId: t.itemId,
    item: t.item?.name ?? null,
    targetQty: t.targetQty === null ? null : num(t.targetQty),
    targetValue: t.targetValue === null ? null : num(t.targetValue),
    updatedAt: t.createdAt.toISOString(),
  }));
}

export async function createTarget(actor: Actor, raw: unknown) {
  const input = targetSchema.parse(raw);
  const unit = input.distributorId ? (await requireDistributor(actor, input.distributorId)).businessUnitId : await primaryUnit(actor);
  if (input.employeeId) await requireEmployee(actor, input.employeeId);
  await db().rtmTarget.create({ data: { ...input, businessUnitId: unit, createdBy: actorName(actor) } });
  return listTargets(actor);
}

export async function deleteTarget(actor: Actor, id: string) {
  const units = await unitIds(actor);
  const t = await db().rtmTarget.findFirst({ where: { id, businessUnitId: { in: units } } });
  if (!t) throw notFound("Target");
  await db().rtmTarget.delete({ where: { id } });
  return listTargets(actor);
}
