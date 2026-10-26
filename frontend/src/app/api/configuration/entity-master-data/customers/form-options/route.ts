import { getFormOptions } from "@/features/configuration/entity-master-data/customer/server/customer.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getFormOptions(actor)));
