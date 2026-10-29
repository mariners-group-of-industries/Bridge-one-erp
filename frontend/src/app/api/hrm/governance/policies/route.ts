import { policyGrid } from "@/features/hrm/governance/server/governance.service";
import { POLICY_TABS, type PolicyTab } from "@/features/hrm/governance/types";
import { notFound } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

const query = (request: Request) => new URL(request.url).searchParams;
const optionalId = (value: string | null, entity: string) => (value ? parseId(value, entity) : undefined);

const date = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

/** ?tab & ?officeId & ?fromDate & ?toDate & ?employeeId */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = query(request);
  const tab = params.get("tab") ?? "";
  if (!POLICY_TABS.some((t) => t.id === tab)) throw notFound("Settings tab");
  return ok(
    await policyGrid(actor, tab as PolicyTab, {
      officeId: optionalId(params.get("officeId"), "Office"),
      employeeId: optionalId(params.get("employeeId"), "Employee"),
      fromDate: date(params.get("fromDate")),
      toDate: date(params.get("toDate")),
    }),
  );
});
