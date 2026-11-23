import { myNotifications } from "@/features/ess/server/ess.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** ?limit= (default 50): the login's notifications, unread count and current notices. */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  return ok(await myNotifications(actor, Number.isFinite(limit) ? limit : 50));
});
