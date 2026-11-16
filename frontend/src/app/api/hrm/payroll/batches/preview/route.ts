import { previewPayroll } from "@/features/hrm/payroll/server/payroll-batch.service";
import { generateInputSchema } from "@/features/hrm/payroll/batch-types";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** Salary Generate preview: calculates without saving. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await previewPayroll(actor, await parseJson(request, generateInputSchema))));
