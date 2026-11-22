import { db } from "@/lib/prisma/client";

/**
 * What each employee is meant to do on each day, from HR Governance and
 * Calendar Assign. In order of precedence:
 *   1. Calendar Assign: the calendar (or OFF / HOL) picked for that day.
 *   2. Holidays: a holiday of the employee's office (or of every office).
 *   3. Off Day: a weekly off day of the office, from its effective date.
 *   4. Roster: the employee's calendar over a period (fixed or rotational).
 * Days with none of these have no plan; attendance then falls back to the
 * Atten Process rule.
 */

/** Calendar Assign codes that are not calendars. */
export const OFF_CODE = "OFF";
export const HOLIDAY_CODE = "HOL";

export interface WorkCalendar {
  id: string;
  officeId: string | null;
  name: string;
  shortCode: string;
  /** "HH:MM", 24-hour. */
  startTime: string;
  endTime: string;
  /** Punching in after this is Late. */
  graceTime: string | null;
  /** Punching in after this is Absent. */
  lastStartTime: string | null;
}

export type DayPlan =
  | { kind: "work"; calendar: WorkCalendar; source: "assigned" | "roster" }
  | { kind: "off"; source: "assigned" | "off-day" }
  | { kind: "holiday"; title: string; source: "assigned" | "holiday" };

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const record = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** A calendar that ends the next day (Night 22:00–06:00). */
export const isOvernight = (c: Pick<WorkCalendar, "startTime" | "endTime">) => minutesOf(c.endTime) <= minutesOf(c.startTime);

/** Every day from `from` to `to`, YYYY-MM-DD. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) out.push(iso(new Date(t)));
  return out;
}

/** The calendars of HR Governance › Calendar Setup that have usable times. */
export async function workCalendars(): Promise<WorkCalendar[]> {
  const rows = await db().hrPolicyRecord.findMany({ where: { tab: "calendar-setup" }, select: { id: true, officeId: true, data: true } });
  return rows.flatMap((r) => {
    const d = record(r.data);
    if (typeof d.name !== "string" || typeof d.shortCode !== "string" || !isTime(d.startTime) || !isTime(d.endTime)) return [];
    return [{
      id: r.id,
      officeId: r.officeId,
      name: d.name,
      shortCode: d.shortCode.trim(),
      startTime: d.startTime,
      endTime: d.endTime,
      graceTime: isTime(d.graceTime) ? d.graceTime : null,
      lastStartTime: isTime(d.lastStartTime) ? d.lastStartTime : null,
    }];
  });
}

/** The calendar an office uses for a code: its own first, then an every-office one. Codes are case-sensitive ("g" ≠ "G"). */
export function calendarForCode(calendars: WorkCalendar[], officeId: string, code: string): WorkCalendar | undefined {
  const matching = calendars.filter((c) => c.shortCode === code.trim());
  return matching.find((c) => c.officeId === officeId) ?? matching.find((c) => c.officeId === null);
}

function calendarForName(calendars: WorkCalendar[], officeId: string, name: unknown): WorkCalendar | undefined {
  if (typeof name !== "string") return undefined;
  const matching = calendars.filter((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  return matching.find((c) => c.officeId === officeId) ?? matching.find((c) => c.officeId === null);
}

/**
 * The plan of every listed employee for every day of the range, keyed
 * "<employeeId>:<YYYY-MM-DD>". Days without a plan are left out.
 */
export async function dayPlans(employees: { id: string; officeId: string }[], from: string, to: string): Promise<Map<string, DayPlan>> {
  const plans = new Map<string, DayPlan>();
  if (employees.length === 0 || from > to) return plans;
  const ids = employees.map((e) => e.id);
  const officeIds = [...new Set(employees.map((e) => e.officeId))];
  const range = { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) };
  const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])];

  const [calendars, assigned, policies] = await Promise.all([
    workCalendars(),
    db().employeeCalendarDay.findMany({ where: { employeeId: { in: ids }, date: range }, select: { employeeId: true, date: true, code: true, calendarId: true } }),
    db().hrPolicyRecord.findMany({
      where: {
        OR: [
          { tab: "holidays", OR: [{ officeId: null }, { officeId: { in: officeIds } }] },
          { tab: "off-day", OR: [{ officeId: null }, { officeId: { in: officeIds } }], effectiveFrom: { lte: range.lte } },
          { tab: "roster", employeeId: { in: ids }, OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: range.lte } }] },
        ],
      },
      select: { tab: true, officeId: true, employeeId: true, effectiveFrom: true, effectiveTo: true, data: true },
    }),
  ]);
  const byId = new Map(calendars.map((c) => [c.id, c]));

  // Holidays: office (or every office) → date → title.
  const holidays = new Map<string, string>();
  for (const p of policies.filter((p) => p.tab === "holidays")) {
    const d = record(p.data);
    if (!years.includes(String(d.year ?? ""))) continue;
    for (const line of Array.isArray(d.holidays) ? d.holidays.map(record) : []) {
      if (typeof line.date === "string") holidays.set(`${p.officeId ?? "*"}:${line.date}`, typeof line.title === "string" ? line.title : "Holiday");
    }
  }
  // Off days: per office, the latest rule in force on the day wins.
  const offRules = policies
    .filter((p) => p.tab === "off-day" && p.effectiveFrom)
    .map((p) => ({ officeId: p.officeId, from: iso(p.effectiveFrom!), days: (Array.isArray(record(p.data).days) ? record(p.data).days : []) as string[] }))
    .sort((a, b) => b.from.localeCompare(a.from));
  const rosters = policies.filter((p) => p.tab === "roster");

  for (const e of employees) {
    const own = assigned.filter((a) => a.employeeId === e.id);
    const assignedOn = new Map(own.map((a) => [iso(a.date), a]));
    const myRosters = rosters.filter((r) => r.employeeId === e.id);
    for (const date of daysBetween(from, to)) {
      const key = `${e.id}:${date}`;
      const day = assignedOn.get(date);
      if (day) {
        if (day.code === OFF_CODE) plans.set(key, { kind: "off", source: "assigned" });
        else if (day.code === HOLIDAY_CODE) plans.set(key, { kind: "holiday", title: "Holiday", source: "assigned" });
        else {
          const calendar = (day.calendarId && byId.get(day.calendarId)) || calendarForCode(calendars, e.officeId, day.code);
          if (calendar) plans.set(key, { kind: "work", calendar, source: "assigned" });
        }
        continue;
      }
      const holiday = holidays.get(`${e.officeId}:${date}`) ?? holidays.get(`*:${date}`);
      if (holiday) {
        plans.set(key, { kind: "holiday", title: holiday, source: "holiday" });
        continue;
      }
      const weekday = WEEKDAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
      const offRule = offRules.find((r) => r.officeId === e.officeId && r.from <= date) ?? offRules.find((r) => r.officeId === null && r.from <= date);
      if (offRule?.days.includes(weekday)) {
        plans.set(key, { kind: "off", source: "off-day" });
        continue;
      }
      const roster = myRosters
        .filter((r) => (!r.effectiveFrom || iso(r.effectiveFrom) <= date) && (!r.effectiveTo || iso(r.effectiveTo) >= date))
        .sort((a, b) => (b.effectiveFrom ? iso(b.effectiveFrom) : "").localeCompare(a.effectiveFrom ? iso(a.effectiveFrom) : ""))[0];
      if (roster) {
        const d = record(roster.data);
        let name = d.calendar;
        const every = Number(d.rotateEveryDays);
        if (d.pattern === "Rotational" && d.nextCalendar && every >= 1 && roster.effectiveFrom) {
          // Rotational: calendar for the first block of days, then the next one, alternating.
          const since = Math.floor((Date.parse(`${date}T00:00:00Z`) - roster.effectiveFrom.getTime()) / 86_400_000);
          if (Math.floor(since / every) % 2 === 1) name = d.nextCalendar;
        }
        const calendar = calendarForName(calendars, e.officeId, name);
        if (calendar) plans.set(key, { kind: "work", calendar, source: "roster" });
      }
    }
  }
  return plans;
}
