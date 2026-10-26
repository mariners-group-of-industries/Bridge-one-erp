import { createEntry, listEntries } from "@/features/production/entries/services/entry.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/production/entries[?from&to&departmentId&departmentSectionId&status&search] */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await listEntries(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST body: production against an order; consumes materials and adds the output to stock. */
export const POST = apiHandler("production:write", async (request, _context, actor) =>
  ok(await createEntry(actor, await request.json().catch(() => null)), 201),
);
