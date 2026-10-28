import { applyMovement, listMovements } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { movementInputSchema } from "@/features/hrm/self-service/leave-movement/schemas/leave-movement.schema";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (request, _context, actor) => ok(await listMovements(actor, new URL(request.url).searchParams.get("employeeId") || undefined)));

export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await applyMovement(actor, await parseJson(request, movementInputSchema)), 201));
