import { listPayroll, processPayroll } from "@/features/hrm/payroll/server/payroll.service";
import { processPayrollSchema } from "@/features/hrm/payroll/types";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

const query = (request: Request) => new URL(request.url).searchParams;
const optionalId = (value: string | null, entity: string) => (value ? parseId(value, entity) : undefined);

/** ?month=YYYY-MM (required) & ?officeId */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = query(request);
  return ok(await listPayroll(actor, { month: params.get("month") ?? "", officeId: optionalId(params.get("officeId"), "Office") }));
});

/** Processes (locks) one office's payroll for a month. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  const { officeId, month } = await parseJson(request, processPayrollSchema);
  return ok(await processPayroll(actor, officeId, month), 201);
});
