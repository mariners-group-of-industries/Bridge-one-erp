import { postingStatus, savePostingRoles } from "@/lib/accounting/posting.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** GET: posting roles, their GL accounts, and documents waiting per type. */
export const GET = apiHandler("accounts:read", async () => ok(await postingStatus()));

/** PUT { [role]: accountId | null }: map roles to GL accounts. */
export const PUT = apiHandler("accounts:write", async (request, _context, actor) => {
  await savePostingRoles(await request.json().catch(() => ({})), (actor.name ?? actor.id).slice(0, 150));
  return ok(await postingStatus());
});
