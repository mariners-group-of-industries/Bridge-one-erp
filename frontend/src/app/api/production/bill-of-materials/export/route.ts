import { bomListExcel, bomListPdf } from "@/features/production/bom/services/bom-export";
import { apiHandler } from "@/lib/api/handler";

/** GET ?format=xlsx|pdf&details=true&<list filters>: the Bill Of Material list as Excel or PDF. */
export const GET = apiHandler("production:read", async (request, _context, actor) => {
  const { format = "xlsx", ...params } = Object.fromEntries(new URL(request.url).searchParams);
  const pdf = format === "pdf";
  const bytes = pdf ? await bomListPdf(actor, params) : await bomListExcel(actor, params);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bill-of-material.${pdf ? "pdf" : "xlsx"}"`,
    },
  });
});
