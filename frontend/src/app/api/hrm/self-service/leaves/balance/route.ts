import { leaveBalance } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Leave balance for ?employeeId (master account) or the signed-in employee, for ?year (default: this year). */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = new URL(request.url).searchParams;
  const year = Number(params.get("year"));
  return ok(await leaveBalance(actor, params.get("employeeId") || undefined, Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : undefined));
});
