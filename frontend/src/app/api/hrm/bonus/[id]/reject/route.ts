import { decideBonus } from "@/features/hrm/compensation/server/compensation.service";
import { apiHandler, noContent, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await decideBonus(actor, parseId((await context.params).id, "Bonus"), "Rejected");
  return noContent();
});
