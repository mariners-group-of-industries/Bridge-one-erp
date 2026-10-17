import { createWorkCenter, listWorkCenters } from "@/features/production/work-centers/services/work-center.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/production/work-centers[?typeId&departmentId&departmentSectionId] */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await listWorkCenters(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST body: a work center with its operators. */
export const POST = apiHandler("production:write", async (request, _context, actor) =>
  ok(await createWorkCenter(actor, await request.json().catch(() => null)), 201),
);
