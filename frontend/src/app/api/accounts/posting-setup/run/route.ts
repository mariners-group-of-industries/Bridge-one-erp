import { postPendingDocuments } from "@/lib/accounting/posting.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** POST: post every document not in the ledger yet (also runs after each save in the modules). */
export const POST = apiHandler("accounts:write", async (_request, _context, actor) => ok(await postPendingDocuments((actor.name ?? actor.id).slice(0, 150))));
