import { deletePolicyRecord, updatePolicyRecord } from "@/features/hrm/governance/server/policy-records.service";
import { apiHandler, noContent, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

export const PUT = apiHandler("employees:read", async (request, context: Context, actor) =>
  ok(await updatePolicyRecord(actor, parseId((await context.params).id, "Setting"), await request.json().catch(() => ({})))),
);

export const DELETE = apiHandler("employees:read", async (_request, context: Context, actor) => {
  await deletePolicyRecord(actor, parseId((await context.params).id, "Setting"));
  return noContent();
});
