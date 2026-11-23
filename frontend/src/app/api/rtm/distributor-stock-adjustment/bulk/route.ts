import { bulkAdjust } from "@/features/rtm/server/stock.service";
import { apiHandler, ok } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";

/** POST multipart { file (.xlsx), year, month, reason?, remarks? }: one adjustment per distributor from a counted-stock sheet. */
export const POST = apiHandler("sales:write", async (request, _c, actor) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose the Excel file to upload.");
  if (file.size > 10 * 1024 * 1024) throw badRequest("The file is larger than 10 MB.");
  const fields = Object.fromEntries([...form!.entries()].filter(([k, v]) => k !== "file" && typeof v === "string"));
  return ok(await bulkAdjust(actor, new Uint8Array(await file.arrayBuffer()), fields), 201);
});
