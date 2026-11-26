import { overtimeSummary } from "@/features/hrm/overtime/server/overtime.service";
import { summaryQuerySchema } from "@/features/hrm/overtime/types";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/hrm/overtime/summary?officeId&month=YYYY-MM: approved overtime and its amount per employee. */
export const GET = apiHandler("employees:read", async (request, _context, actor) =>
  ok(await overtimeSummary(actor, summaryQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)))),
);
