import { unprocessPayroll } from "@/features/hrm/payroll/server/payroll.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Undoes processing; the month is calculated live again. */
export const DELETE = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await unprocessPayroll(actor, parseId((await context.params).id, "Payroll"));
  return noContent();
});
