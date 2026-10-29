import { createPolicyRecord, listPolicyRecords } from "@/features/hrm/governance/server/policy-records.service";
import { POLICY_TABS, type PolicyTab } from "@/features/hrm/governance/types";
import { notFound } from "@/lib/api/errors";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

const date = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

function tabOf(request: Request): PolicyTab {
  const tab = new URL(request.url).searchParams.get("tab") ?? "";
  if (!POLICY_TABS.some((t) => t.id === tab)) throw notFound("Settings tab");
  return tab as PolicyTab;
}

/** ?tab & ?officeId & ?employeeId & ?fromDate & ?toDate */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = new URL(request.url).searchParams;
  const id = (key: string, entity: string) => (params.get(key) ? parseId(params.get(key)!, entity) : undefined);
  return ok(
    await listPolicyRecords(actor, tabOf(request), {
      officeId: id("officeId", "Office"),
      employeeId: id("employeeId", "Employee"),
      fromDate: date(params.get("fromDate")),
      toDate: date(params.get("toDate")),
    }),
  );
});

/** ?tab; body: { officeId, employeeId, effectiveFrom, effectiveTo, data } */
export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  const tab = tabOf(request);
  return ok(await createPolicyRecord(actor, tab, await request.json().catch(() => ({}))), 201);
});
