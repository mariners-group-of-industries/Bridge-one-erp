import { exportCustomers, exportTree } from "@/features/configuration/sales-config/territory/server/territory-files";
import { apiHandler, parseId } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Excel download: ?kind=tree (territories) or ?kind=customers (&nodeId optional). */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const params = new URL(request.url).searchParams;
  const businessUnitId = parseId(params.get("businessUnitId") ?? "", "Business unit");
  const kind = params.get("kind") === "customers" ? "customers" : "tree";
  const nodeId = params.get("nodeId");
  const bytes = kind === "tree" ? await exportTree(actor, businessUnitId) : await exportCustomers(actor, businessUnitId, nodeId ? parseId(nodeId, "Territory") : undefined);
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="${kind === "tree" ? "sales-territories" : "territory-customers"}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
