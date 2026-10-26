import { supplierFilterSchema } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { exportSuppliers } from "@/features/configuration/entity-master-data/supplier/server/supplier-excel";
import { apiHandler } from "@/lib/api/handler";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Excel download of the supplier list, with the same search and filters as the list. */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const filters = supplierFilterSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const bytes = await exportSuppliers(actor, filters);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Blob([new Uint8Array(bytes)], { type: XLSX }), {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="suppliers-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
