import { changeQuotationStatus } from "@/features/sales/quotations/services/quotation.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** POST body: { action: "submit" | "cancel" | "lost" | "reopen", version, reason? } */
export const POST = apiHandler<{ params: Promise<{ quotationId: string }> }>(
  "sales:write",
  async (request, context, actor) => {
    const id = parseId((await context.params).quotationId, "Quotation");
    return ok(await changeQuotationStatus(actor, id, await request.json().catch(() => null)));
  },
);
