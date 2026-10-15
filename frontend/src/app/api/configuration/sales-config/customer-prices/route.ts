import { priceListQuerySchema } from "@/features/configuration/sales-config/customer-price/schemas/customer-price.schema";
import { listCustomerPrices, listGroupPrices } from "@/features/configuration/sales-config/customer-price/server/customer-price.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** List for either tab: ?tab=customer (Customer Price) or ?tab=group (Customer Offer). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = priceListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(query.tab === "customer" ? await listCustomerPrices(actor, query) : await listGroupPrices(actor, query));
});
