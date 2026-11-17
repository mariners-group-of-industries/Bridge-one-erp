import { publishPayslips } from "@/features/hrm/payroll/server/payroll-batch.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Releases an Approved payroll's payslips to employees (Employee Self Service). Needs Approve on Payroll. */
export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => ok(await publishPayslips(actor, parseId((await context.params).id, "Payroll"))));
