import { hrOptions } from "@/features/hrm/shared/hr-access";
import { apiHandler, ok } from "@/lib/api/handler";

/** Offices for the HR filter bars (HR only). */
export const GET = apiHandler("employees:read", async (_request, _context, actor) => ok(await hrOptions(actor)));
