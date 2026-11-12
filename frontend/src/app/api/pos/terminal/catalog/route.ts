import { counterCatalog } from "@/features/pos/server/pos.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** GET ?counterId: items with price and the stock at the counter. */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await counterCatalog(actor, parseId(new URL(request.url).searchParams.get("counterId") ?? "", "Counter"))),
);
