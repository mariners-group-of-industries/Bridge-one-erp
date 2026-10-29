import { returnChallanPdf } from "@/features/sales/returns/services/return-export";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ returnId: string }> };

/** GET: Return Note/Challan as a PDF (?download=1 saves it instead of opening it). */
export const GET = apiHandler<Context>("sales:read", async (request, context, actor) => {
  const { number, bytes } = await returnChallanPdf(actor, parseId((await context.params).returnId, "Sales return"));
  const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="${encodeURIComponent(number)}.pdf"` },
  });
});
