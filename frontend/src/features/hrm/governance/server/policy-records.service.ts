import type { Prisma } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { CALENDAR_DEFINITIONS, SPECIAL_CODES } from "../../calendar-assign/constants";
import { decisionBy, employeeScope, isoDate, officeScope, requireHr, toDate } from "../../shared/hr-access";
import { POLICY_TAB_DEFS, policyDataSchema, policyRecordInputSchema, type PolicyRecordInput, type PolicyRecordRow, type PolicyValue } from "../policy-fields";
import type { PolicyFilter, PolicyTab } from "../types";

const LIMIT = 500;

const recordScope = (actor: Actor): Prisma.HrPolicyRecordWhereInput =>
  actor.companyScope === "ALL" ? {} : { AND: [{ OR: [{ officeId: null }, { office: officeScope(actor) }] }, { OR: [{ employeeId: null }, { employee: employeeScope(actor) }] }] };

const include = { office: { select: { name: true } }, employee: { select: { employeeCode: true, name: true } } } as const;
type Stored = Prisma.HrPolicyRecordGetPayload<{ include: typeof include }>;

function toRow(r: Stored): PolicyRecordRow {
  return {
    id: r.id,
    officeId: r.officeId ?? "",
    officeName: r.office?.name ?? null,
    employeeId: r.employeeId ?? "",
    employeeLabel: r.employee ? `${r.employee.employeeCode} — ${r.employee.name}` : null,
    effectiveFrom: r.effectiveFrom ? isoDate(r.effectiveFrom) : "",
    effectiveTo: r.effectiveTo ? isoDate(r.effectiveTo) : "",
    data: (r.data ?? {}) as Record<string, PolicyValue>,
    updatedByName: r.updatedByName ?? r.createdByName,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * Records of a tab, narrowed by the page filters: an office shows its own and
 * all-office records; a date range shows records in force at any time in it.
 */
export async function listPolicyRecords(actor: Actor, tab: PolicyTab, filter: PolicyFilter = {}): Promise<PolicyRecordRow[]> {
  requireHr(actor);
  const and: Prisma.HrPolicyRecordWhereInput[] = [recordScope(actor)];
  if (filter.officeId) and.push({ OR: [{ officeId: null }, { officeId: filter.officeId }] });
  if (filter.employeeId) and.push({ OR: [{ employeeId: null }, { employeeId: filter.employeeId }] });
  if (filter.toDate) and.push({ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: toDate(filter.toDate) } }] });
  if (filter.fromDate) and.push({ OR: [{ effectiveTo: null }, { effectiveTo: { gte: toDate(filter.fromDate) } }] });
  const records = await db().hrPolicyRecord.findMany({ where: { tab, AND: and }, orderBy: [{ effectiveFrom: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: LIMIT, include });
  return records.map(toRow);
}

async function toData(actor: Actor, tab: PolicyTab, input: PolicyRecordInput) {
  const def = POLICY_TAB_DEFS[tab];
  const base = policyRecordInputSchema.parse(input);
  const scope = def.scope;
  const need = (value: string, setting: boolean | "required" | undefined, label: string) => {
    if (setting === "required" && !value) throw badRequest(`${label} is required.`);
    return setting ? value : "";
  };
  const officeId = need(base.officeId, scope.office, "Office");
  const employeeId = need(base.employeeId, scope.employee, "Employee");
  const effectiveFrom = need(base.effectiveFrom, scope.from, scope.fromLabel ?? "Effective From");
  const effectiveTo = need(base.effectiveTo, scope.to, scope.toLabel ?? "Effective To");
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw badRequest(`${scope.toLabel ?? "Effective To"} cannot be before ${scope.fromLabel ?? "Effective From"}.`);
  const data = policyDataSchema(def).parse(base.data) as Record<string, PolicyValue>;
  const problem = def.check?.(data, { effectiveFrom, effectiveTo });
  if (problem) throw badRequest(problem);

  if (officeId && !(await db().office.findFirst({ where: { id: officeId, ...officeScope(actor) }, select: { id: true } }))) throw notFound("Office");
  if (employeeId) {
    const employee = await db().employee.findFirst({ where: { id: employeeId, ...employeeScope(actor) }, select: { officeId: true } });
    if (!employee) throw notFound("Employee");
    if (officeId && employee.officeId !== officeId) throw badRequest("The employee does not belong to the selected office.");
  }
  // A reference must name an existing record of the referenced tab.
  for (const field of def.fields.filter((f) => f.type === "ref" && data[f.key])) {
    const names = await refOptions(actor, field.refTab!);
    if (!names.includes(String(data[field.key]))) throw badRequest(`${field.label} "${data[field.key]}" does not exist. Add it in its tab first.`);
  }
  return {
    officeId: officeId || null,
    employeeId: employeeId || null,
    effectiveFrom: effectiveFrom ? toDate(effectiveFrom) : null,
    effectiveTo: effectiveTo ? toDate(effectiveTo) : null,
    data: data as Prisma.InputJsonValue,
  };
}

export async function createPolicyRecord(actor: Actor, tab: PolicyTab, input: PolicyRecordInput): Promise<PolicyRecordRow> {
  requireHr(actor);
  const record = await db().hrPolicyRecord.create({ data: { tab, ...(await toData(actor, tab, input)), createdByName: decisionBy(actor) }, include });
  return toRow(record);
}

async function loadRecord(actor: Actor, id: string) {
  const record = await db().hrPolicyRecord.findFirst({ where: { id, ...recordScope(actor) }, select: { id: true, tab: true } });
  if (!record || !(record.tab in POLICY_TAB_DEFS)) throw notFound("Setting");
  return record as { id: string; tab: PolicyTab };
}

export async function updatePolicyRecord(actor: Actor, id: string, input: PolicyRecordInput): Promise<PolicyRecordRow> {
  requireHr(actor);
  const { tab } = await loadRecord(actor, id);
  const record = await db().hrPolicyRecord.update({ where: { id }, data: { ...(await toData(actor, tab, input)), updatedByName: decisionBy(actor) }, include });
  return toRow(record);
}

export async function deletePolicyRecord(actor: Actor, id: string) {
  requireHr(actor);
  await loadRecord(actor, id);
  await db().hrPolicyRecord.delete({ where: { id } });
}

/** "9:00 AM" → "09:00"; null when it is not a 12-hour time. */
function to24h(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hours = (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/**
 * Copies the calendars of Calendar Assign › Calendar Info into Calendar Setup,
 * matched to offices by name ("All" = every office). Calendars that already
 * exist for the office (same name) are skipped, so running it again is harmless.
 */
export async function importCalendarInfo(actor: Actor): Promise<{ created: number; skipped: number }> {
  requireHr(actor);
  const definitions = CALENDAR_DEFINITIONS.filter((c) => !(SPECIAL_CODES as readonly string[]).includes(c.shortCode));
  const offices = await db().office.findMany({ where: officeScope(actor), select: { id: true, name: true } });
  const officeOf = new Map(offices.map((o) => [o.name.trim().toLowerCase(), o.id]));
  const existing = await db().hrPolicyRecord.findMany({ where: { tab: "calendar-setup", ...recordScope(actor) }, select: { officeId: true, data: true } });
  const taken = new Set(existing.map((r) => `${r.officeId ?? ""}|${String((r.data as Record<string, unknown>)?.name ?? "").toLowerCase()}`));
  let created = 0;
  let skipped = 0;
  for (const c of definitions) {
    const officeId = c.office === "All" ? "" : officeOf.get(c.office.trim().toLowerCase());
    const key = `${officeId ?? ""}|${c.calendarName.toLowerCase()}`;
    if (officeId === undefined || taken.has(key)) {
      skipped += 1;
      continue;
    }
    await createPolicyRecord(actor, "calendar-setup", {
      officeId,
      data: {
        name: c.calendarName,
        shortCode: c.shortCode,
        startTime: to24h(c.startTime),
        endTime: to24h(c.endTime),
        minWorkHours: c.minWorkHour,
        graceTime: to24h(c.graceTime),
        lastStartTime: to24h(c.lastStartTime),
        breakStartTime: to24h(c.breakStartTime),
        breakEndTime: to24h(c.breakEndTime),
      },
    });
    taken.add(key);
    created += 1;
  }
  return { created, skipped };
}

/** The `name` values of a tab's records, for reference fields (e.g. Roster › Calendar). */
export async function refOptions(actor: Actor, tab: PolicyTab): Promise<string[]> {
  requireHr(actor);
  const records = await db().hrPolicyRecord.findMany({ where: { tab, ...recordScope(actor) }, select: { data: true } });
  const names = records.map((r) => (r.data as Record<string, unknown> | null)?.name).filter((n): n is string => typeof n === "string" && n !== "");
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
