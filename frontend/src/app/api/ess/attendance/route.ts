import { myAttendance } from "@/features/ess/server/ess-attendance.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** ?month=YYYY-MM, or ?from=&to= (at most 93 days); optional ?status=. */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  return ok(await myAttendance(actor, { month: q.get("month"), from: q.get("from"), to: q.get("to"), status: q.get("status") }));
});
