import { z } from "zod";
import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { decisionBy, employeeScope, isoDate, toDate } from "../../shared/hr-access";
import type { RosterGridData } from "../types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHANGES = 20_000;

/** Saved calendars of these employees between the two days (both included). */
export async function getCalendarDays(employeeIds: string[], fromDate: string, toDateStr: string): Promise<RosterGridData> {
  if (employeeIds.length === 0 || !ISO.test(fromDate) || !ISO.test(toDateStr)) return {};
  const rows = await db().employeeCalendarDay.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: toDate(fromDate), lte: toDate(toDateStr) } },
    select: { employeeId: true, date: true, shortCode: true },
  });
  const grid: RosterGridData = {};
  for (const r of rows) (grid[r.employeeId] ??= {})[isoDate(r.date)] = r.shortCode;
  return grid;
}

const changesSchema = z
  .array(
    z.object({
      employeeId: z.string().uuid(),
      date: z.string().regex(ISO),
      /** Empty clears the day. */
      shortCode: z.string().trim().max(20),
    }),
  )
  .max(MAX_CHANGES);

export type CalendarDayChange = z.infer<typeof changesSchema>[number];

/** Writes the changed cells of the Calendar Assign grid; an empty code removes the day. */
export async function saveCalendarDays(actor: Actor, input: unknown): Promise<{ saved: number; cleared: number; skipped: number }> {
  const parsed = changesSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Some calendar assignments are not valid.");

  // Last change per employee and day wins.
  const latest = new Map<string, CalendarDayChange>();
  for (const c of parsed.data) latest.set(`${c.employeeId}|${c.date}`, c);
  const ids = [...new Set([...latest.values()].map((c) => c.employeeId))];
  const allowed = new Set(
    (await db().employee.findMany({ where: { id: { in: ids }, ...employeeScope(actor) }, select: { id: true } })).map((e) => e.id),
  );
  // Employees removed since, or outside the user's access, are skipped.
  const changes = [...latest.values()].filter((c) => allowed.has(c.employeeId));
  const skipped = latest.size - changes.length;
  if (changes.length === 0) return { saved: 0, cleared: 0, skipped };

  const by = decisionBy(actor);
  const byEmployee = new Map<string, Date[]>();
  for (const c of changes) byEmployee.set(c.employeeId, [...(byEmployee.get(c.employeeId) ?? []), toDate(c.date)]);
  const kept = changes.filter((c) => c.shortCode);

  await db().$transaction([
    ...[...byEmployee].map(([employeeId, dates]) => db().employeeCalendarDay.deleteMany({ where: { employeeId, date: { in: dates } } })),
    db().employeeCalendarDay.createMany({
      data: kept.map((c) => ({ employeeId: c.employeeId, date: toDate(c.date), shortCode: c.shortCode, updatedByName: by })),
    }),
  ]);
  return { saved: kept.length, cleared: changes.length - kept.length, skipped };
}
