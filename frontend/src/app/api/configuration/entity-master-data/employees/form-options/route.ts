import { employeeFormOptions } from "@/features/configuration/entity-master-data/employee/server/employee.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (_request, _context, actor) =>
  ok(await employeeFormOptions(actor)),
);
