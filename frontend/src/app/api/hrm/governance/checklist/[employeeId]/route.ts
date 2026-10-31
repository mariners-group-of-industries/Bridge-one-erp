import { z } from "zod";
import { setChecklistFlag } from "@/features/hrm/governance/server/governance.service";
import { CHECKLIST_FLAGS, type ChecklistFlag } from "@/features/hrm/governance/types";
import { apiHandler, noContent, parseId, parseJson } from "@/lib/api/handler";

type Context = { params: Promise<{ employeeId: string }> };

const bodySchema = z.object({
  flag: z.enum(CHECKLIST_FLAGS.map((f) => f.key) as [ChecklistFlag, ...ChecklistFlag[]]),
  value: z.boolean(),
});

/** body: { flag: "overtime" | "pf" | "holdSalary", value } */
export const PATCH = apiHandler("employees:read", async (request, context: Context, actor) => {
  const { flag, value } = await parseJson(request, bodySchema);
  await setChecklistFlag(actor, parseId((await context.params).employeeId, "Employee"), flag, value);
  return noContent();
});
