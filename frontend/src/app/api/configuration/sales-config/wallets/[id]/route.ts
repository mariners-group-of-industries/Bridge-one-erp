import { walletInputSchema } from "@/features/configuration/sales-config/wallet/schemas/wallet.schema";
import { deleteWallet, getWallet, updateWallet } from "@/features/configuration/sales-config/wallet/server/wallet.service";
import { apiHandler, noContent, ok, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };
const idOf = async (context: Context) => parseId((await context.params).id, "Wallet");

export const GET = apiHandler("configuration:read", async (_request, context: Context, actor) => ok(await getWallet(actor, await idOf(context))));

export const PUT = apiHandler("configuration:write", async (request, context: Context, actor) => ok(await updateWallet(actor, await idOf(context), await parseJson(request, walletInputSchema))));

export const DELETE = apiHandler("configuration:write", async (_request, context: Context, actor) => {
  await deleteWallet(actor, await idOf(context));
  return noContent();
});
