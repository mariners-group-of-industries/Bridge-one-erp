import { z } from "zod";
import { createDocument, listDocuments } from "@/features/configuration/entity-master-data/employee/server/document.service";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  documentType: z.string().trim().min(1).max(100),
  documentName: z.string().trim().min(1).max(150),
  issueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fileName:     z.string().trim().max(255).nullable().optional(),
});

export const GET = apiHandler("employees:read", async (_req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  return ok(await listDocuments(parseId(id, "Employee"), actor));
});

export const POST = apiHandler("employees:read", async (req, ctx: Ctx, actor) => {
  const { id } = await ctx.params;
  const input = await parseJson(req, createSchema);
  return ok(await createDocument(parseId(id, "Employee"), actor, {
    documentType: input.documentType,
    documentName: input.documentName,
    issueDate:    input.issueDate ?? null,
    fileName:     input.fileName ?? null,
  }), 201);
});
