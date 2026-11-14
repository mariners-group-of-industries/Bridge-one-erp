import { apiHandler, parseId } from "@/lib/api/handler";
import { accountsAttachmentResponse } from "@/lib/accounting/attachments";

type Context = { params: Promise<{ attachmentId: string }> };

/** Download an attached file; served through the API so access stays authorised. */
export const GET = apiHandler("accounts:read", async (_request, context: Context) =>
  accountsAttachmentResponse(parseId((await context.params).attachmentId, "Attachment")),
);
