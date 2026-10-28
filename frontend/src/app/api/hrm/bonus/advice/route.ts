import { listBonusAdvice } from "@/features/hrm/compensation/server/compensation.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (request, _context, actor) => ok(await listBonusAdvice(actor, new URL(request.url).searchParams.get("status") || undefined)));
