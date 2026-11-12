import { calculateOvertime } from "@/features/hrm/overtime/server/overtime.service";
import { calculateQuerySchema } from "@/features/hrm/overtime/types";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/hrm/overtime/calculate?officeId&from&to: overtime per employee and day from the attendance punches. */
export const GET = apiHandler("employees:read", async (request, _context, actor) =>
  ok(await calculateOvertime(actor, calculateQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)))),
);
