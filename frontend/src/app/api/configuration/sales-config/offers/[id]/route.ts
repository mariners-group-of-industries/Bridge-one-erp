import type { OfferInput } from "@/features/configuration/sales-config/offer/schemas/offer.schema";
import { getOffer, updateOffer } from "@/features/configuration/sales-config/offer/server/offer.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Offer");
  return ok(await getOffer(actor, id));
});

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Offer");
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as OfferInput;
  return ok(await updateOffer(actor, id, body));
});
