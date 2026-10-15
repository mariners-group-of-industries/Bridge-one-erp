import type { SupplierInput } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { getSupplier, updateSupplier } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Supplier");
  return ok(await getSupplier(actor, id));
});

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => {
  const id = parseId((await context.params).id, "Supplier");
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as SupplierInput;
  return ok(await updateSupplier(actor, id, body));
});
