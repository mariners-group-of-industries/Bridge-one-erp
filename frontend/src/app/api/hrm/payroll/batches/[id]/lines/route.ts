import { listPayrollLines } from "@/features/hrm/payroll/server/payroll-batch.service";
import { apiHandler, ok, parseId } from "@/lib/api/handler";

type Context = { params: Promise<{ id: string }> };

/** Employee salaries of a batch: ?search & ?sort & ?dir & ?page & ?pageSize & ?issues=1 */
export const GET = apiHandler("employees:read", async (request, context: Context, actor) => {
  const q = new URL(request.url).searchParams;
  return ok(
    await listPayrollLines(actor, parseId((await context.params).id, "Payroll"), {
      search: q.get("search") ?? undefined,
      sort: q.get("sort") ?? undefined,
      dir: q.get("dir") ?? undefined,
      page: Number(q.get("page")) || 1,
      pageSize: Number(q.get("pageSize")) || 50,
      issues: q.get("issues") === "1",
    }),
  );
});
