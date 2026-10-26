import { RETURN_EXPORT_TABS, returnTabExcel, type ReturnExportTab } from "@/features/sales/returns/services/return-export";
import { badRequest } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";

/** GET ?tab=deliveries|returns|market (+ the tab's filters): the list as .xlsx. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const { tab, ...filters } = Object.fromEntries(new URL(request.url).searchParams);
  if (!RETURN_EXPORT_TABS.includes(tab as ReturnExportTab)) throw badRequest("Unknown return list.");
  const bytes = await returnTabExcel(actor, tab as ReturnExportTab, filters);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sales-return-${tab}.xlsx"`,
    },
  });
});
