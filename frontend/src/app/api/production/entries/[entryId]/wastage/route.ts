import { entryWastageForm, saveEntryWastage } from "@/features/production/entries/services/wastage.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ entryId: string }> };

/** "Process Wise Wastage Entry": header, saved lines, processes and items. */
export const GET = apiHandler<Context>("production:read", async (_request, context, actor) =>
  ok(await entryWastageForm(actor, parseId((await context.params).entryId, "Production entry"))),
);

/** PUT body: { lines: [{ processId, itemId, qty }] }. Replaces the entry's wastage lines. */
export const PUT = apiHandler<Context>("production:write", async (request, context, actor) =>
  ok(await saveEntryWastage(actor, parseId((await context.params).entryId, "Production entry"), await request.json().catch(() => null))),
);
