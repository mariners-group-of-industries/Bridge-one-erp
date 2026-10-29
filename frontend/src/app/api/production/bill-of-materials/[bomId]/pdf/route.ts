import { bomDetailPdf } from "@/features/production/bom/services/bom-export";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ bomId: string }> };

/** GET: "Bill Of Material Details" as a PDF download. */
export const GET = apiHandler<Context>("production:read", async (_request, context, actor) => {
  const { name, bytes } = await bomDetailPdf(actor, parseId((await context.params).bomId, "Bill of material"));
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name.replace(/[^\w.-]+/g, "-"))}.pdf"`,
    },
  });
});
