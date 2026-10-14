import { z } from "zod";
import { getBill } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

const asOfSchema = z.object({ asOf: z.iso.date() });

export const GET = apiHandler<{ params: Promise<{ billId: string }> }>("sales:read", async (request, context, actor) => {
  const { asOf } = asOfSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await getBill(actor, parseId((await context.params).billId, "Bill"), asOf));
});
