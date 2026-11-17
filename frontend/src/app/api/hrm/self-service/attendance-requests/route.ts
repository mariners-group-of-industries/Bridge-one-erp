import { z } from "zod";
import { ADJUSTABLE_STATUSES } from "@/features/hrm/attendance/types";
import { myAttendanceDay, myAttendanceRequests, requestOwnAttendanceChange } from "@/features/hrm/attendance/services/attendance.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/**
 * Employee Self Service › Attendance: the signed-in employee's own requests,
 * and (with ?date=YYYY-MM-DD) their attendance on that day.
 */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const date = new URL(request.url).searchParams.get("date");
  if (date) return ok({ day: await myAttendanceDay(actor, date) });
  return ok(await myAttendanceRequests(actor));
});

const RequestBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  requestedStatus: z.enum(ADJUSTABLE_STATUSES, { error: "Choose the status you need." }),
  inTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time."), z.literal("")]).nullish(),
  outTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time."), z.literal("")]).nullish(),
  reason: z.string().trim().min(1, "Enter the reason for the change.").max(500),
});

/** Asks HR to change the employee's own attendance; it waits in Pending Approval › Attendance. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  const body = await parseJson(request, RequestBody);
  const saved = await requestOwnAttendanceChange(actor, body);
  return ok({ id: saved.id }, 201);
});
