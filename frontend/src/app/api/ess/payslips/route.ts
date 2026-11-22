import { myPayslips } from "@/features/ess/server/ess.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** The employee's published payslips (approved payrolls HR has released). */
export const GET = apiHandler("employees:read", async (_request, _context, actor) => ok(await myPayslips(actor)));
