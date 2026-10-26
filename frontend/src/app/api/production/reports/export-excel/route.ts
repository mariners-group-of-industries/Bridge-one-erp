import { reportExcel } from "@/features/production/reports/services/report-export";
import { apiHandler } from "@/lib/api/handler";

/** GET (same query as the report): the report as a formatted .xlsx file. */
export const GET = apiHandler("production:read", async (request, _context, actor) => {
  const { name, bytes } = await reportExcel(actor, Object.fromEntries(new URL(request.url).searchParams));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"` },
  });
});
