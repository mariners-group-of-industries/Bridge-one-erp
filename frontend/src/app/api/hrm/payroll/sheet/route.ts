import { salarySheet } from "@/features/hrm/payroll/server/payroll.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** Salary generate sheet / advice: ?officeId & ?month=YYYY-MM. */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = new URL(request.url).searchParams;
  return ok(await salarySheet(actor, parseId(params.get("officeId") ?? "", "Office"), params.get("month") ?? ""));
});
