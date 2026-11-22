import { disbursementSheet } from "@/features/hrm/payroll/server/payroll-batch.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** Salary Disbursement (advice / generate sheet) from the payroll engine: ?officeId & ?month=YYYY-MM. */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = new URL(request.url).searchParams;
  return ok(await disbursementSheet(actor, parseId(params.get("officeId") ?? "", "Office"), params.get("month") ?? ""));
});
