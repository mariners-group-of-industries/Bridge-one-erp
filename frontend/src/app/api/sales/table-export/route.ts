import { tableExport } from "@/features/sales/lib/table-export";
import { apiHandler } from "@/lib/api/handler";

/** POST { format: xlsx|pdf, title, headers, rows }: the table as an Excel or PDF file. */
export const POST = apiHandler("sales:read", async (request) => {
  const { bytes, contentType, fileName } = await tableExport(await request.json().catch(() => null));
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${fileName}"` } });
});
