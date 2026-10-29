import { searchEmployees } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** Employee search (?search) for the master account's Employee field. */
export const GET = apiHandler("employees:read", async (request, _context, actor) => ok(await searchEmployees(actor, new URL(request.url).searchParams.get("search") ?? "")));
