import { getMyProfile } from "@/features/hrm/self-service/profile/server/profile.service";
import { apiHandler, ok } from "@/lib/api/handler";

/** The signed-in person's own employee record. */
export const GET = apiHandler("employees:read", async (_request, _context, actor) => ok(await getMyProfile(actor)));
