import { saveReturnPricesSchema, returnPriceQuerySchema } from "@/features/configuration/sales-config/return-price/schemas/return-price.schema";
import { listReturnPrices, saveReturnPrices } from "@/features/configuration/sales-config/return-price/server/return-price.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** Items of the filter with their current return rates (?businessUnitId, itemType, categoryId, subCategoryId, search, page, pageSize). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = returnPriceQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listReturnPrices(actor, query));
});

/** Save the edited rows: { businessUnitId, rows: [...] }. */
export const PUT = apiHandler("configuration:write", async (request, _context, actor) => ok(await saveReturnPrices(actor, await parseJson(request, saveReturnPricesSchema))));
