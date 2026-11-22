import { getPendingDocuments } from "@/features/approvals/server/summary.service";
import { apiHandler, ok } from "@/lib/api/handler";

type Context = { params: Promise<{ categoryId: string }> };

/** Multilayer Approval: the pending documents of one approval category, oldest first. */
export const GET = apiHandler<Context>("configuration:read", async (_request, context, actor) => ok(await getPendingDocuments(actor, (await context.params).categoryId)));
