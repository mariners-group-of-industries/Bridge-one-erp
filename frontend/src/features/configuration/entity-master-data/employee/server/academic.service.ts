import { notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { AcademicDto, UpsertAcademicsInput } from "../schemas/academic.schema";

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
  id: string; isForeigner: boolean; institute: string; degree: string;
  fieldOfStudy: string; result: string; scale: string;
  startDate: Date; finishDate: Date;
}): AcademicDto => ({
  id:           r.id,
  isForeigner:  r.isForeigner,
  institute:    r.institute,
  degree:       r.degree,
  fieldOfStudy: r.fieldOfStudy,
  result:       r.result,
  scale:        r.scale,
  startDate:    r.startDate.toISOString().slice(0, 10),
  finishDate:   r.finishDate.toISOString().slice(0, 10),
});

export async function getAcademics(employeeId: string, actor: Actor): Promise<AcademicDto[]> {
  await assertEmployee(employeeId, actor);
  const rows = await db().employeeAcademic.findMany({
    where: { employeeId },
    orderBy: { startDate: "asc" },
  });
  return rows.map(toDto);
}

export async function upsertAcademics(
  employeeId: string,
  actor: Actor,
  input: UpsertAcademicsInput,
): Promise<AcademicDto[]> {
  await assertEmployee(employeeId, actor);
  await db().$transaction([
    db().employeeAcademic.deleteMany({ where: { employeeId } }),
    ...(input.entries.length > 0
      ? [db().employeeAcademic.createMany({
          data: input.entries.map((e) => ({
            employeeId,
            isForeigner:  e.isForeigner,
            institute:    e.institute,
            degree:       e.degree,
            fieldOfStudy: e.fieldOfStudy,
            result:       e.result,
            scale:        e.scale,
            startDate:    new Date(e.startDate),
            finishDate:   new Date(e.finishDate),
          })),
        })]
      : []),
  ]);
  return getAcademics(employeeId, actor);
}
