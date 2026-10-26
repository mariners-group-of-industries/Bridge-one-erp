import { createBom, listBoms } from "@/features/production/bom/services/bom.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/production/bill-of-materials[?departmentId&departmentSectionId&status=ACTIVE|INACTIVE&search] */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await listBoms(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST body: the BOM with its production items, input materials, wastage output and overheads. */
export const POST = apiHandler("production:write", async (request, _context, actor) =>
  ok(await createBom(actor, await request.json().catch(() => null)), 201),
);
