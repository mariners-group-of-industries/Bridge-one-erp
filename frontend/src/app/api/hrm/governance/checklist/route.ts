import { employeeChecklist } from "@/features/hrm/governance/server/governance.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

/** Employee Assign checklist: ?officeId & ?employeeId */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const params = new URL(request.url).searchParams;
  const id = (key: string, entity: string) => (params.get(key) ? parseId(params.get(key)!, entity) : undefined);
  return ok(await employeeChecklist(actor, { officeId: id("officeId", "Office"), employeeId: id("employeeId", "Employee") }));
});
