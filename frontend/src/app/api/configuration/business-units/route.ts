import { businessUnitInputSchema } from "@/features/configuration/business-config/company-profile/schemas/business-unit.schema";
import {
  createBusinessUnit,
  listBusinessUnits,
} from "@/features/configuration/business-config/company-profile/server/business-unit.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) =>
  ok(await listBusinessUnits(actor)),
);

export const POST = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, businessUnitInputSchema);
  return ok(await createBusinessUnit(actor, input), 201);
});
