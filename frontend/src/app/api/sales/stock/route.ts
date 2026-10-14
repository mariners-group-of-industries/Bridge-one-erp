import { z } from "zod";
import { adjustStock, getStockLevels } from "@/features/sales/deliveries/services/stock.service";
import { apiHandler, noContent, ok } from "@/lib/api/handler";

const querySchema = z.object({
  warehouseId: z.uuid(),
  itemIds: z
    .string()
    .transform((value) => value.split(",").filter(Boolean))
    .pipe(z.array(z.uuid()).max(500)),
});

/** GET /api/sales/stock?warehouseId=…&itemIds=a,b,c */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const { warehouseId, itemIds } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await getStockLevels(actor, warehouseId, itemIds));
});

/** POST body: opening stock or adjustment (signed qty). */
export const POST = apiHandler("sales:write", async (request, _context, actor) => {
  await adjustStock(actor, await request.json().catch(() => null));
  return noContent();
});
