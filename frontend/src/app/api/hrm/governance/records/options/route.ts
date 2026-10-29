import { refOptions } from "@/features/hrm/governance/server/policy-records.service";
import { POLICY_TABS, type PolicyTab } from "@/features/hrm/governance/types";
import { notFound } from "@/lib/api/errors";
import { apiHandler, ok } from "@/lib/api/handler";

/** Names of a tab's records (?tab), for reference fields such as Roster › Calendar. */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const tab = new URL(request.url).searchParams.get("tab") ?? "";
  if (!POLICY_TABS.some((t) => t.id === tab)) throw notFound("Settings tab");
  return ok(await refOptions(actor, tab as PolicyTab));
});
