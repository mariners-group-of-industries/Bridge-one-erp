import { orderPdf } from "@/features/production/orders/services/order-pdf";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string }> };

/** GET: the production order as a printable PDF. */
export const GET = apiHandler<Context>("production:read", async (_request, context, actor) => {
  const { number, bytes } = await orderPdf(actor, parseId((await context.params).orderId, "Production order"));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(number)}.pdf"` },
  });
});
