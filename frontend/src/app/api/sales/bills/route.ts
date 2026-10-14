import { z } from "zod";
import { createBill, listBills } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

const asOfSchema = z.object({ asOf: z.iso.date() });

/** GET /api/sales/bills?asOf=YYYY-MM-DD[&officeId]: live bills with something owed. */
export const GET = apiHandler("sales:read", async (request, _context, actor) =>
  ok(await listBills(actor, Object.fromEntries(new URL(request.url).searchParams))),
);

/** POST /api/sales/bills?asOf=… body: { officeId, customerId, billDate, remarks, deliveryIds }. */
export const POST = apiHandler("sales:write", async (request, _context, actor) => {
  const { asOf } = asOfSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await createBill(actor, await request.json().catch(() => null), asOf), 201);
});
