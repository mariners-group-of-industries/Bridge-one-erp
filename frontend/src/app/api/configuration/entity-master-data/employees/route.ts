import { createEmployeeSchema } from "@/features/configuration/entity-master-data/employee/schemas/employee.schema";
import { employeeListQuerySchema } from "@/features/configuration/entity-master-data/employee/schemas/employee.schema";
import { createEmployee, listEmployees } from "@/features/configuration/entity-master-data/employee/server/employee.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (request, _context, actor) => {
  const query = employeeListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listEmployees(actor, query));
});

export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  const input = await parseJson(request, createEmployeeSchema);
  return ok(await createEmployee(actor, input), 201);
});
