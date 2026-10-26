import { treeTemplate } from "@/features/configuration/sales-config/territory/server/territory-files";
import { apiHandler, parseId } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Empty upload template with a code and name column per layer. */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const businessUnitId = parseId(new URL(request.url).searchParams.get("businessUnitId") ?? "", "Business unit");
  const bytes = await treeTemplate(actor, businessUnitId);
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: { "Content-Type": XLSX, "Content-Disposition": 'attachment; filename="sales-territory-template.xlsx"', "Cache-Control": "no-store" },
  });
});
