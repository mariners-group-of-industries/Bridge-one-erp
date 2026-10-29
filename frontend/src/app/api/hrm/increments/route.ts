import { createIncrement, listIncrements } from "@/features/hrm/compensation/server/compensation.service";
import { incrementInputSchema } from "@/features/hrm/compensation/types";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

const query = (request: Request) => new URL(request.url).searchParams;
const optionalId = (value: string | null, entity: string) => (value ? parseId(value, entity) : undefined);

const date = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

/** ?officeId & ?status & ?fromDate & ?toDate (effective date). */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = query(request);
  return ok(
    await listIncrements(actor, {
      officeId: optionalId(params.get("officeId"), "Office"),
      status: params.get("status") || undefined,
      fromDate: date(params.get("fromDate")),
      toDate: date(params.get("toDate")),
    }),
  );
});

export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await createIncrement(actor, await parseJson(request, incrementInputSchema)), 201));
