import { apiHandler, ok } from "@/lib/api/handler";
import { saveAccountsAttachment } from "@/lib/accounting/attachments";

/** Upload one file (multipart/form-data, field `file`) to attach to a store issue (iBOS "Attachment"). */
export const POST = apiHandler("purchase:write", async (request, _context, actor) =>
  ok(await saveAccountsAttachment(request, "store-issue", actor.name ?? actor.id), 201),
);
