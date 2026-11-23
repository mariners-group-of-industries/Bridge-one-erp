import { deleteOutletAttachment, readOutletAttachment } from "@/features/rtm/server/outlet.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string; attachmentId: string }> };

/** The file itself (shown inline: images and PDFs open in the browser). */
export const GET = apiHandler("sales:read", async (_request, context: Context, actor) => {
  const { id, attachmentId } = await context.params;
  const file = await readOutletAttachment(actor, parseId(id, "Outlet"), parseId(attachmentId, "Attachment"));
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = apiHandler("sales:write", async (_request, context: Context, actor) => {
  const { id, attachmentId } = await context.params;
  await deleteOutletAttachment(actor, parseId(id, "Outlet"), parseId(attachmentId, "Attachment"));
  return ok(null);
});
