import { entryPdf } from "@/features/production/entries/services/entry-pdf";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ entryId: string }> };

/** GET: the production entry slip as a printable PDF. */
export const GET = apiHandler<Context>("production:read", async (_request, context, actor) => {
  const { number, bytes } = await entryPdf(actor, parseId((await context.params).entryId, "Production entry"));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(number)}.pdf"` },
  });
});
