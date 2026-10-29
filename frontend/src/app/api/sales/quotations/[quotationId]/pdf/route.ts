import { quotationPdf } from "@/features/sales/quotations/services/quotation-export";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ quotationId: string }> };

/** GET: the quotation as a printable A4 PDF. */
export const GET = apiHandler<Context>("sales:read", async (_request, context, actor) => {
  const { number, bytes } = await quotationPdf(actor, parseId((await context.params).quotationId, "Quotation"));
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(number)}.pdf"` } });
});
