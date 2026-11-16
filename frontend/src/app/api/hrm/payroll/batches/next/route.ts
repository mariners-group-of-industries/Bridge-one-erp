import { payrollSequence } from "@/features/hrm/payroll/server/payroll-batch.service";
import { SALARY_TYPES } from "@/features/hrm/payroll/batch-types";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** The office's latest payroll and the month its next one must be for: ?officeId & ?salaryType */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const salaryType = SALARY_TYPES.find((t) => t === q.get("salaryType")) ?? SALARY_TYPES[0];
  return ok(await payrollSequence(actor, parseId(q.get("officeId") ?? "", "Office"), salaryType));
});
