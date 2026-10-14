import { getFormOptions } from "@/features/configuration/entity-master-data/supplier/server/supplier.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getFormOptions(actor)));
