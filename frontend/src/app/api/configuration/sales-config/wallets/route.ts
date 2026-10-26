import { walletInputSchema } from "@/features/configuration/sales-config/wallet/schemas/wallet.schema";
import { createWallet, listWallets } from "@/features/configuration/sales-config/wallet/server/wallet.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

/** ?search, page, pageSize */
export const GET = apiHandler("configuration:read", async (request, _context, actor) => ok(await listWallets(actor, Object.fromEntries(new URL(request.url).searchParams))));

export const POST = apiHandler("configuration:write", async (request, _context, actor) => ok(await createWallet(actor, await parseJson(request, walletInputSchema)), 201));
