import { essMe } from "@/features/ess/server/ess.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Whether the signed-in login is linked to an employee record (Employee Self Service). */
export const GET = apiHandler("employees:read", async (_request, _context, actor) => ok(await essMe(actor)));
