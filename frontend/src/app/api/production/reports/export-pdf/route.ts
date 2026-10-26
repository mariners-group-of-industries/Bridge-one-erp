import { reportPdf } from "@/features/production/reports/services/report-export";
import { apiHandler } from "@/lib/api/handler";

/** GET (same query as the report): an A4 landscape PDF to print. */
export const GET = apiHandler("production:read", async (request, _context, actor) => {
  const { name, bytes } = await reportPdf(actor, Object.fromEntries(new URL(request.url).searchParams));
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
});
