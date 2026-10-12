import { companyInputSchema } from "@/features/configuration/business-config/company-profile/schemas/company.schema";
import {
  getCompany,
  saveCompany,
} from "@/features/configuration/business-config/company-profile/server/company.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) =>
  ok(await getCompany(actor)),
);

export const PUT = apiHandler("configuration:write", async (request, _context, actor) => {
  const input = await parseJson(request, companyInputSchema);
  return ok(await saveCompany(actor, input));
});
