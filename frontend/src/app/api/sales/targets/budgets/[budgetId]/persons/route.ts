import { saveBudgetPerson } from "@/features/sales/targets/services/target.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** PUT body: { salesPersonId, months: [{ month, value }] }. No months removes the sales force. */
export const PUT = apiHandler<{ params: Promise<{ budgetId: string }> }>("sales:write", async (request, context, actor) =>
  ok(await saveBudgetPerson(actor, parseId((await context.params).budgetId, "Target"), await request.json().catch(() => null))),
);
