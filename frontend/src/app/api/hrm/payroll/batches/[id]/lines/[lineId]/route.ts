import { getPayrollLine } from "@/features/hrm/payroll/server/payroll-batch.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string; lineId: string }> };

/** One employee's salary with attendance counts and the calculation trace. */
export const GET = apiHandler("employees:read", async (_request, context: Context, actor) => {
  const { id, lineId } = await context.params;
  return ok(await getPayrollLine(actor, parseId(id, "Payroll"), parseId(lineId, "Payroll line")));
});
