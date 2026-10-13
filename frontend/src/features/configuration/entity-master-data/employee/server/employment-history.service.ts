import { notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { EmploymentHistoryDto, UpsertEmploymentHistoryInput } from "../schemas/employment-history.schema";

async function assertEmployee(id: string, actor: Actor) {
  const emp = await db().employee.findUnique({
    where: { id },
    include: { office: { include: { businessUnit: true } } },
  });
  if (!emp || !emp.office?.businessUnit) throw notFound("Employee");
  if (
    !actor.isMaster &&
    actor.companyScope !== "ALL" &&
    !actor.companyScope.includes(emp.office.businessUnit.companyId)
  ) throw notFound("Employee");
  return emp;
}

const toDto = (r: {
  id: string; companyName: string; jobTitle: string; location: string;
  description: string | null; fromDate: Date; toDate: Date;
}): EmploymentHistoryDto => ({
  id:          r.id,
  companyName: r.companyName,
  jobTitle:    r.jobTitle,
  location:    r.location,
  description: r.description ?? "",
  fromDate:    r.fromDate.toISOString().slice(0, 10),
  toDate:      r.toDate.toISOString().slice(0, 10),
});

export async function getEmploymentHistory(employeeId: string, actor: Actor): Promise<EmploymentHistoryDto[]> {
  await assertEmployee(employeeId, actor);
  const rows = await db().employmentHistory.findMany({
    where: { employeeId },
    orderBy: { fromDate: "desc" },
  });
  return rows.map(toDto);
}

export async function upsertEmploymentHistory(
  employeeId: string,
  actor: Actor,
  input: UpsertEmploymentHistoryInput,
): Promise<EmploymentHistoryDto[]> {
  await assertEmployee(employeeId, actor);
  await db().$transaction([
    db().employmentHistory.deleteMany({ where: { employeeId } }),
    ...(input.entries.length > 0
      ? [db().employmentHistory.createMany({
          data: input.entries.map((e) => ({
            employeeId,
            companyName: e.companyName,
            jobTitle:    e.jobTitle,
            location:    e.location,
            description: e.description || null,
            fromDate:    new Date(e.fromDate),
            toDate:      new Date(e.toDate),
          })),
        })]
      : []),
  ]);
  return getEmploymentHistory(employeeId, actor);
}
