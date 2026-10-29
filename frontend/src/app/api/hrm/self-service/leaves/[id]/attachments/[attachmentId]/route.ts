import { readLeaveAttachment } from "@/features/hrm/self-service/leave-movement/server/leave-movement.service";
import { apiHandler, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string; attachmentId: string }> };

/** Streams the file through the API so access stays authorised. */
export const GET = apiHandler("employees:read", async (_request, context: Context, actor) => {
  const params = await context.params;
  const file = await readLeaveAttachment(actor, parseId(params.id, "Leave application"), parseId(params.attachmentId, "Attachment"));
  return new Response(new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});
