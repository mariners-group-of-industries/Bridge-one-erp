import { getWalletFormOptions } from "@/features/configuration/sales-config/wallet/server/wallet.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("configuration:read", async (_request, _context, actor) => ok(await getWalletFormOptions(actor)));
