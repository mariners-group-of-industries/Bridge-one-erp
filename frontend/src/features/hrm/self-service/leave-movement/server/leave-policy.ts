import { dayPlans, daysBetween } from "@/features/hrm/attendance/services/day-plan.service";
import { db } from "@/lib/prisma/client";
import { LEAVE_TYPES } from "../schemas/leave-movement.schema";

/**
 * Leave rules from HR Governance › Settings / Policies:
 * - "Leave" tab: the leave types an employee may take, with yearly quota,
 *   gender, carry forward, notice and attachment rules. The office's own record
 *   wins over an every-office one; within those, the latest effective date wins.
 *   Without any Leave record the built-in defaults (LEAVE_TYPES) apply, so a
 *   company that has not set up leave policies keeps working as before.
 * - "Sandwich Leave" tab: whether off days and holidays between leave days count.
 */

export interface LeaveTypeRule {
  name: string;
  shortCode: string | null;
  /** Yearly days; null = not limited (no balance tracked). */
  quota: number | null;
  carryForward: boolean;
  maxCarryDays: number | null;
  halfDayAllowed: boolean;
  /** Apply at least this many days ahead; null = any time. */
  noticeDays: number | null;
  /** Longer applications need an attachment; null = never. */
  attachmentAfterDays: number | null;
  /** "policy" when it comes from HR Governance, "default" for the built-in list. */
  source: "policy" | "default";
}

export interface LeaveSubject {
  id: string;
  officeId: string;
  gender: string | null;
}

const record = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const int = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const truthy = (v: unknown) => v === true || v === "true" || v === "Yes";
const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function defaults(): LeaveTypeRule[] {
  return LEAVE_TYPES.map((t) => ({
    name: t.name,
    shortCode: null,
    quota: t.quota,
    carryForward: false,
    maxCarryDays: null,
    halfDayAllowed: false,
    noticeDays: null,
    attachmentAfterDays: null,
    source: "default" as const,
  }));
}

/** Policy records of one tab for the office (or every office) in force on `date`, office records first, newest first. */
export async function policiesInForce(tab: string, officeId: string, date: string) {
  const rows = await db().hrPolicyRecord.findMany({
    where: {
      tab,
      employeeId: null,
      OR: [{ officeId }, { officeId: null }],
      AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: dateOf(date) } }] }, { OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateOf(date) } }] }],
    },
    select: { officeId: true, effectiveFrom: true, data: true },
  });
  return rows.sort((a, b) => (a.officeId === b.officeId ? (isoOf(b.effectiveFrom) ?? "").localeCompare(isoOf(a.effectiveFrom) ?? "") : a.officeId ? -1 : 1));
}

/** Whether any Leave policy exists at all for the office (in force or not). */
async function hasLeavePolicies(officeId: string) {
  return (await db().hrPolicyRecord.count({ where: { tab: "leave", OR: [{ officeId }, { officeId: null }] } })) > 0;
}

/** The leave types `employee` may take on `date` (YYYY-MM-DD). */
export async function leaveTypesFor(employee: LeaveSubject, date: string): Promise<LeaveTypeRule[]> {
  if (!(await hasLeavePolicies(employee.officeId))) return defaults();
  const gender = employee.gender?.trim().toLowerCase() ?? "";
  const seen = new Set<string>();
  const byName = new Map<string, LeaveTypeRule>();
  for (const row of await policiesInForce("leave", employee.officeId, date)) {
    const d = record(row.data);
    const name = typeof d.name === "string" ? d.name.trim() : "";
    // The first (office's own, newest) record of a type decides it.
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const appliesTo = typeof d.gender === "string" ? d.gender.trim().toLowerCase() : "all";
    // Gender-specific types need the employee's gender on record.
    if (appliesTo && appliesTo !== "all" && appliesTo !== gender) continue;
    byName.set(name.toLowerCase(), {
      name,
      shortCode: typeof d.shortCode === "string" ? d.shortCode : null,
      quota: int(d.yearlyQuota),
      carryForward: truthy(d.carryForward),
      maxCarryDays: int(d.maxCarryDays),
      halfDayAllowed: truthy(d.halfDayAllowed),
      noticeDays: int(d.noticeDays),
      attachmentAfterDays: int(d.attachmentAfterDays),
      source: "policy",
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface ChargeableDays {
  /** Days that use the leave balance. */
  days: number;
  /** Calendar days in the range. */
  calendarDays: number;
  /** Dates not charged (off days, holidays), for the applicant. */
  excluded: { date: string; reason: string }[];
}

/**
 * Leave days charged for `from`–`to`: working days from the employee's day plan
 * (Calendar Assign, Holidays, Off Day, Roster). Off days and holidays are not
 * charged, unless the Sandwich Leave rule counts those lying between two
 * charged days. Days without any plan count as working days.
 */
export async function chargeableDays(employee: LeaveSubject, leaveType: string, from: string, to: string): Promise<ChargeableDays> {
  const dates = daysBetween(from, to);
  const [plans, sandwich] = await Promise.all([dayPlans([{ id: employee.id, officeId: employee.officeId }], from, to), policiesInForce("sandwich-leave", employee.officeId, from)]);
  const rule = sandwich
    .map((r) => record(r.data))
    .find((d) => {
      const types = typeof d.leaveTypes === "string" ? d.leaveTypes.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
      return types.length === 0 || types.includes(leaveType.toLowerCase());
    });
  const kindOf = (date: string) => plans.get(`${employee.id}:${date}`)?.kind ?? "work";
  const working = dates.filter((d) => kindOf(d) === "work");
  const first = working[0];
  const last = working[working.length - 1];
  let days = 0;
  const excluded: ChargeableDays["excluded"] = [];
  for (const date of dates) {
    const kind = kindOf(date);
    if (kind === "work") {
      days += 1;
      continue;
    }
    const between = !!first && date > first && date < last;
    const counts = between && (kind === "off" ? truthy(rule?.countOffDays) : truthy(rule?.countHolidays));
    if (counts) days += 1;
    else excluded.push({ date, reason: kind === "off" ? "Weekly off" : "Holiday" });
  }
  return { days, calendarDays: dates.length, excluded };
}
