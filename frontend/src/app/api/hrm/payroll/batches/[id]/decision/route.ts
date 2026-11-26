import { decidePayrollBatch } from "@/features/hrm/payroll/server/payroll-batch.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Approve the current stage or reject: { decision, remarks, version }. Needs the page's Approve permission. */
export const POST = apiHandler("employees:read", async (request, context: Context, actor) =>
  ok(await decidePayrollBatch(actor, parseId((await context.params).id, "Payroll"), await request.json().catch(() => ({})))),
);
