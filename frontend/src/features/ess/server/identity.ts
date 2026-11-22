import { AppError } from "@/lib/api/errors";
import { actorUserId, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { dayKey } from "@/features/hrm/attendance/services/attendance.service";

/**
 * Employee Self Service identity: the employee linked to the signed-in login
 * (Employee › ERP Access sets `employees.userId`, which is unique, so a login
 * maps to at most one employee).
 *
 * Every ESS service starts here. The employee is never taken from the request,
 * so changing an id in a URL, query or body cannot reach another employee.
 */
export interface SelfEmployee {
  id: string;
  code: string;
  name: string;
  officeId: string;
  officeName: string;
  businessUnitId: string;
  designation: string | null;
  department: string | null;
  departmentSection: string | null;
  gender: string | null;
  joiningDate: string;
  terminationDate: string | null;
  isActive: boolean;
  /** New applications are allowed only while employed and active. */
  canApply: boolean;
}

export const NOT_LINKED_MESSAGE = "Your login is not linked to an employee record yet. Ask HR to link it in Employee › ERP Access.";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The linked employee, or null when the login has none (or the caller is not a signed-in person). */
export async function findSelf(actor: Actor): Promise<SelfEmployee | null> {
  // API tokens and system actors are not people.
  if (actor.via !== "session") return null;
  const userId = actorUserId(actor);
  if (!userId) return null;
  const e = await db().employee.findUnique({
    where: { userId },
    select: {
      id: true,
      employeeCode: true,
      name: true,
      officeId: true,
      office: { select: { name: true, businessUnitId: true } },
      designation: true,
      department: true,
      departmentSection: true,
      gender: true,
      joiningDate: true,
      terminationDate: true,
      isActive: true,
    },
  });
  if (!e) return null;
  const today = dayKey.format(new Date());
  const terminationDate = e.terminationDate ? iso(e.terminationDate) : null;
  return {
    id: e.id,
    code: e.employeeCode,
    name: e.name,
    officeId: e.officeId,
    officeName: e.office.name,
    businessUnitId: e.office.businessUnitId,
    designation: e.designation,
    department: e.department,
    departmentSection: e.departmentSection,
    gender: e.gender,
    joiningDate: iso(e.joiningDate),
    terminationDate,
    isActive: e.isActive,
    canApply: e.isActive && (!terminationDate || terminationDate >= today),
  };
}

/** The linked employee; 403 when the login has none. */
export async function requireSelf(actor: Actor): Promise<SelfEmployee> {
  const self = await findSelf(actor);
  if (!self) throw new AppError(403, "FORBIDDEN", NOT_LINKED_MESSAGE, { reason: "NOT_LINKED" });
  return self;
}

/** The linked employee, refusing new requests from someone no longer employed. */
export async function requireActiveSelf(actor: Actor): Promise<SelfEmployee> {
  const self = await requireSelf(actor);
  if (!self.canApply) throw new AppError(403, "FORBIDDEN", "Your employment record is inactive, so new requests cannot be submitted. Contact HR.");
  return self;
}
