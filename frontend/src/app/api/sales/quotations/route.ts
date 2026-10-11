import { quotationInputSchema, quotationListQuerySchema } from "@/features/sales/quotations/schemas/quotation.schema";
import { createQuotation, listQuotations } from "@/features/sales/quotations/services/quotation.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** GET /api/sales/quotations?today=YYYY-MM-DD[&officeId&from&to&status] */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const query = quotationListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listQuotations(actor, query));
});

export const POST = apiHandler("sales:write", async (request, _context, actor) =>
  ok(await createQuotation(actor, await parseJson(request, quotationInputSchema)), 201),
);
