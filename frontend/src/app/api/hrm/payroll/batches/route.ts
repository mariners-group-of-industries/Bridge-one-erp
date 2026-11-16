import { createPayrollBatch, listPayrollBatches } from "@/features/hrm/payroll/server/payroll-batch.service";
import { generateInputSchema } from "@/features/hrm/payroll/batch-types";
import { apiHandler, ok, parseId, parseJson } from "@/lib/api/handler";

/** Payroll batches: ?officeId & ?month=MM & ?year=YYYY & ?status & ?search & ?page & ?pageSize */
export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const officeId = q.get("officeId");
  return ok(
    await listPayrollBatches(actor, {
      officeId: officeId ? parseId(officeId, "Office") : undefined,
      month: /^(0[1-9]|1[0-2])$/.test(q.get("month") ?? "") ? q.get("month")! : undefined,
      year: /^\d{4}$/.test(q.get("year") ?? "") ? q.get("year")! : undefined,
      status: q.get("status") ?? undefined,
      search: q.get("search") ?? undefined,
      page: Number(q.get("page")) || 1,
      pageSize: Number(q.get("pageSize")) || 20,
    }),
  );
});

/** Calculates the office's salaries for the month and saves them as a Draft batch. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await createPayrollBatch(actor, await parseJson(request, generateInputSchema)), 201));
