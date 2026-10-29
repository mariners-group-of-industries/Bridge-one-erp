import { orderPdf } from "@/features/sales/orders/services/order-export";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ orderId: string }> };

/** GET: the order as a printable PDF (?download=1 saves it instead of opening it). */
export const GET = apiHandler<Context>("sales:read", async (request, context, actor) => {
  const { number, bytes } = await orderPdf(actor, parseId((await context.params).orderId, "Sales order"));
  const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="${encodeURIComponent(number)}.pdf"` },
  });
});
