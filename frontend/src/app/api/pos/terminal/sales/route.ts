import { listSales } from "@/features/pos/server/pos.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET ?counterId[&from][&to]: sales of a counter (today by default). */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  return ok(await listSales(actor, { counterId: q.get("counterId") || undefined, from: q.get("from") || today, to: q.get("to") || today }));
});
