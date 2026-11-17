import { withdrawCorrection } from "@/features/ess/server/ess.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await withdrawCorrection(actor, parseId((await context.params).id, "Attendance request"));
  return noContent();
});
