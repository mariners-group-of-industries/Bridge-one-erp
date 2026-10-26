import { entryForm } from "@/features/production/entries/services/entry.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** GET ?orderId: the open order with its materials (standard per unit, rate, stock) and form options. */
export const GET = apiHandler("production:read", async (request, _context, actor) =>
  ok(await entryForm(actor, parseId(new URL(request.url).searchParams.get("orderId") ?? "", "Production order"))),
);
