import { createSectionSchema } from "@/features/configuration/entity-master-data/customer/schemas/customer.schema";
import { createSection } from "@/features/configuration/entity-master-data/customer/server/customer.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** "+ Add new" Section for shipping rows (a Sales area of kind SECTION). */
export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, createSectionSchema);
  return ok(await createSection(actor, input), 201);
});
