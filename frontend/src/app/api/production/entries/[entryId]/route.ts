import { getEntry } from "@/features/production/entries/services/entry.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ entryId: string }> };

export const GET = apiHandler<Context>("production:read", async (_request, context, actor) =>
  ok(await getEntry(actor, parseId((await context.params).entryId, "Production entry"))),
);
