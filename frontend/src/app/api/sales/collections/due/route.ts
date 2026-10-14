import { listDue } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET — Due List: customers with something owed. */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listDue(actor, Object.fromEntries(new URL(request.url).searchParams))),
);
