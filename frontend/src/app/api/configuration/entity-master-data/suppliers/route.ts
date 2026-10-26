import { supplierListQuerySchema, type SupplierInput } from "@/features/configuration/entity-master-data/supplier/schemas/supplier.schema";
import { createSupplier, listSuppliers } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { badRequest } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (request, _context, actor) => {
  const query = supplierListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listSuppliers(actor, query));
});

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const body = (await request.json().catch(() => {
    throw badRequest("Request body must be valid JSON.");
  })) as SupplierInput;
  // The service validates the body with the shared schema.
  return ok(await createSupplier(actor, body), 201);
});
