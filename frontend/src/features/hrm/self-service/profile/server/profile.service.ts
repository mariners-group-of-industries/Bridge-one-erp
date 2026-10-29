import { actorUserId, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { ProfileList } from "../types";

/**
 * The signed-in person's own employee record, linked through Employee › ERP
 * Access. Every login sees only its own record; a login without one sees none.
 */
export async function getMyProfile(actor: Actor): Promise<ProfileList> {
  const userId = actorUserId(actor);
  if (!userId) return { rows: [] };
  const employees = await db().employee.findMany({
    where: { userId },
    orderBy: [{ employeeCode: "asc" }],
    select: { id: true, employeeCode: true, name: true, designation: true, department: true, employeeType: true, joiningDate: true, supervisor: true },
  });
  return {
    rows: employees.map((e) => ({
      id: e.id,
      code: e.employeeCode,
      name: e.name,
      designation: e.designation,
      department: e.department,
      employeeType: e.employeeType,
      joiningDate: e.joiningDate.toISOString().slice(0, 10),
      supervisor: e.supervisor,
    })),
  };
}
