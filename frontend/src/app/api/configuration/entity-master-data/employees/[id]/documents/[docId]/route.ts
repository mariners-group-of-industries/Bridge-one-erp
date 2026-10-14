import { deleteDocument } from "@/features/configuration/entity-master-data/employee/server/document.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string; docId: string }> };

export const DELETE = apiHandler("employees:read", async (_req, ctx: Ctx, actor) => {
  const { id, docId } = await ctx.params;
  await deleteDocument(parseId(id, "Employee"), parseId(docId, "Document"), actor);
  return noContent();
});
