import { offerListQuerySchema, type OfferInput } from "@/features/configuration/sales-config/offer/schemas/offer.schema";
import { createOffer, listOffers } from "@/features/configuration/sales-config/offer/server/offer.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = offerListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listOffers(actor, query));
});

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as OfferInput;
  // The service validates the body with the shared schema.
  return ok(await createOffer(actor, body), 201);
});
