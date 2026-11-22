import { myPayslip } from "@/features/ess/server/ess.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("employees:read", async (_request, context: Context, actor) => ok(await myPayslip(actor, parseId((await context.params).id, "Payslip"))));
