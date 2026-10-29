import { z } from "zod";
import { collectionWallets } from "@/features/sales/collections/services/collection.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET /api/sales/collections/wallets?officeId: Wallet Setup wallets for Due Collection. */
export const GET = apiHandler("sales:read", async (request, _context, actor) => {
  const officeId = z.uuid().parse(new URL(request.url).searchParams.get("officeId"));
  return ok(await collectionWallets(actor, officeId));
});
