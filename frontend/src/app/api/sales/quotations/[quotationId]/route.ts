import {
  deleteQuotation,
  getQuotation,
  updateQuotation,
} from "@/features/sales/quotations/services/quotation.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = RouteContext<"/api/sales/quotations/[quotationId]">;

export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => {
  const id = parseId((await context.params).quotationId, "Quotation");
  return ok(await getQuotation(actor, id));
});

/** PUT body: { version: updatedAt, data: QuotationInput }. Drafts only. */
export const PUT = apiHandler<Context>("sales:write", async (request, context, actor) => {
  const id = parseId((await context.params).quotationId, "Quotation");
  return ok(await updateQuotation(actor, id, await request.json().catch(() => null)));
});

export const DELETE = apiHandler<Context>("sales:write", async (_request, context, actor) => {
  await deleteQuotation(actor, parseId((await context.params).quotationId, "Quotation"));
  return noContent();
});
