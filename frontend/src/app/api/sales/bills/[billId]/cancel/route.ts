import { z } from "zod";
import { cancelBill } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

const asOfSchema = z.object({ asOf: z.iso.date() });

/** POST ?asOf=… body: { version, reason }. */
export const POST = apiHandler<{ params: Promise<{ billId: string }> }>("sales:write", async (request, context, actor) => {
  const { asOf } = asOfSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await cancelBill(actor, parseId((await context.params).billId, "Bill"), await request.json().catch(() => null), asOf));
});
