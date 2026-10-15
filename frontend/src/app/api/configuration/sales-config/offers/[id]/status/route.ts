import { z } from "zod";
import { setOfferActive } from "@/features/configuration/sales-config/offer/server/offer.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Active/Inactive toggle from the offer list. */
export const PATCH = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Offer");
  const { isActive } = await parseJson(request, z.object({ isActive: z.boolean() }));
  return ok(await setOfferActive(actor, id, isActive));
});
