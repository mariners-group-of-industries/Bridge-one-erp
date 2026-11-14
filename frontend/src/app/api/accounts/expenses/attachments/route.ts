import { apiHandler, ok } from "@/lib/api/handler";
import { saveAccountsAttachment } from "@/lib/accounting/attachments";

/** Upload one file (multipart/form-data, field `file`) to attach to an expense. */
export const POST = apiHandler("accounts:write", async (request, _context, actor) =>
  ok(await saveAccountsAttachment(request, "expenses", actor.name ?? actor.id), 201),
);
