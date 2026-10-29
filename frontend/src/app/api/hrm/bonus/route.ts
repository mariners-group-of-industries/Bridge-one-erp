import { createBonus, listBonusRuns } from "@/features/hrm/compensation/server/compensation.service";
import { bonusInputSchema } from "@/features/hrm/compensation/types";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (request, _context, actor) => ok(await listBonusRuns(actor, new URL(request.url).searchParams.get("status") || undefined)));

export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await createBonus(actor, await parseJson(request, bonusInputSchema)), 201));
