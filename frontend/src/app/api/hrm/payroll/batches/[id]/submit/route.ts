import { submitPayrollBatch } from "@/features/hrm/payroll/server/payroll-batch.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler("employees:read", async (request, context: Context, actor) => {
  await submitPayrollBatch(actor, parseId((await context.params).id, "Payroll"), await request.json().catch(() => ({})));
  return noContent();
});
