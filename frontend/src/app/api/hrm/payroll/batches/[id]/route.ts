import { getPayrollBatch, updatePayrollBatch } from "@/features/hrm/payroll/server/payroll-batch.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("employees:read", async (_request, context: Context, actor) => ok(await getPayrollBatch(actor, parseId((await context.params).id, "Payroll"))));

/** Payroll date and description of a Draft or Rejected batch. */
export const PATCH = apiHandler("employees:read", async (request, context: Context, actor) => {
  await updatePayrollBatch(actor, parseId((await context.params).id, "Payroll"), await request.json().catch(() => ({})));
  return noContent();
});
