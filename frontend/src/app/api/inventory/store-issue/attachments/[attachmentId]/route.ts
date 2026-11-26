import { apiHandler, parseId } from "@/lib/api/handler";
import { accountsAttachmentResponse } from "@/lib/accounting/attachments";

type Context = { params: Promise<{ attachmentId: string }> };

/** Download a store issue attachment; served through the API so access stays authorised. */
export const GET = apiHandler("purchase:read", async (_request, context: Context) =>
  accountsAttachmentResponse(parseId((await context.params).attachmentId, "Attachment"), "inventory/store-issue/"),
);
