import * as argon2 from "argon2";
import { AppError, conflict, notFound } from "@/lib/api/errors";
import { actorUserId, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type {
  AccountSettingsDto,
  CreateRoleInput,
  CredentialsDto,
  OrgAccessDto,
  OrgOptionsDto,
  PersonalInfoDto,
  RoleDto,
  UpdateAccountSettingsInput,
  UpdateCredentialsInput,
  UpdateOrgAccessInput,
  UpdatePersonalInfoInput,
} from "../schemas/personal-info.schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const orNull = (s: string | null | undefined) => s || null;

async function loadEmployee(id: string, actor: Actor) {
  // First check the employee exists without the deep include, so we can
  // distinguish "employee not found" from "office/BU relation broken".
  const exists = await db().employee.findUnique({ where: { id }, select: { id: true, officeId: true } });
  if (!exists) throw notFound("Employee");

  const emp = await db().employee.findUnique({
    where: { id },
    include: { office: { include: { businessUnit: true } } },
  });
  // If the office or businessUnit relation is missing, surface a clear error.
  if (!emp || !emp.office || !emp.office.businessUnit) {
    throw new AppError(500, "INTERNAL_ERROR", "Employee office configuration is incomplete.");
  }
  // Scope check
  if (
    actor.companyScope !== "ALL" &&
    !actor.companyScope.includes(emp.office.businessUnit.companyId)
  ) {
    throw notFound("Employee");
  }
  return emp;
}

// ─── Personal info ────────────────────────────────────────────────────────────

export async function getPersonalInfo(id: string, actor: Actor): Promise<PersonalInfoDto> {
  const emp = await loadEmployee(id, actor);
  return {
    id: emp.id,
    employeeCode: emp.employeeCode,
    attendanceId: emp.attendanceId,
    name: emp.name,
    designation: emp.designation,
    hrPosition: emp.hrPosition,
    department: emp.department,
    departmentSection: emp.departmentSection,
    employeeType: emp.employeeType,
    serviceCategory: emp.serviceCategory,
    employeePolicy: emp.employeePolicy,
    location: emp.location,
    joiningDate: dateOnly(emp.joiningDate),
    confirmationDate: emp.confirmationDate ? dateOnly(emp.confirmationDate) : null,
    terminationDate: emp.terminationDate ? dateOnly(emp.terminationDate) : null,
    mobile: emp.mobile,
    email: emp.email,
    officialContact: emp.officialContact,
    religion: emp.religion,
    gender: emp.gender,
    bloodGroup: emp.bloodGroup,
    dateOfBirth: emp.dateOfBirth ? dateOnly(emp.dateOfBirth) : null,
    fathersName: emp.fathersName,
    mothersName: emp.mothersName,
    nidNumber: emp.nidNumber,
    presentAddress: emp.presentAddress,
    permanentAddress: emp.permanentAddress,
    supervisor: emp.supervisor,
    lineManager: emp.lineManager,
    officeName: emp.office.name,
  };
}

export async function updatePersonalInfo(
  id: string,
  actor: Actor,
  input: UpdatePersonalInfoInput,
): Promise<PersonalInfoDto> {
  await loadEmployee(id, actor);
  // Only update employeeCode if a new value was provided
  const newCode = input.employeeCode?.trim() || null;
  if (newCode) {
    const codeConflict = await db().employee.findFirst({
      where: { employeeCode: newCode, NOT: { id } },
      select: { id: true },
    });
    if (codeConflict) throw conflict("An employee with this Employee ID already exists.");
  }
  const toDate = (s?: string) => (s ? new Date(s) : null);
  await db().employee.update({
    where: { id },
    data: {
      ...(newCode ? { employeeCode: newCode } : {}),
      name:              input.name,
      attendanceId:      orNull(input.attendanceId),
      designation:       orNull(input.designation),
      hrPosition:        orNull(input.hrPosition),
      department:        orNull(input.department),
      departmentSection: orNull(input.departmentSection),
      employeeType:      orNull(input.employeeType),
      serviceCategory:   orNull(input.serviceCategory),
      employeePolicy:    orNull(input.employeePolicy),
      location:          orNull(input.location),
      joiningDate:       new Date(input.joiningDate),
      confirmationDate:  toDate(input.confirmationDate),
      terminationDate:   toDate(input.terminationDate),
      mobile:            orNull(input.mobile),
      email:             orNull(input.email),
      officialContact:   orNull(input.officialContact),
      religion:          orNull(input.religion),
      gender:            orNull(input.gender),
      bloodGroup:        orNull(input.bloodGroup),
      dateOfBirth:       toDate(input.dateOfBirth),
      fathersName:       orNull(input.fathersName),
      mothersName:       orNull(input.mothersName),
      nidNumber:         orNull(input.nidNumber),
      presentAddress:    orNull(input.presentAddress),
      permanentAddress:  orNull(input.permanentAddress),
      supervisor:        orNull(input.supervisor),
      lineManager:       orNull(input.lineManager),
      updatedById:       actorUserId(actor),
    },
  });
  return getPersonalInfo(id, actor);
}

// ─── Account settings ─────────────────────────────────────────────────────────

export async function getAccountSettings(id: string, actor: Actor): Promise<AccountSettingsDto> {
  const emp = await loadEmployee(id, actor);
  return {
    holdSalary:          emp.holdSalary,
    departmentApproval:  emp.departmentApproval,
    isService:           emp.isService,
    holdPayment:         emp.holdPayment,
    isReseller:          emp.isReseller,
    isUser:              emp.isUser,
    isMasterUser:        emp.isMasterUser,
    loginWithEmployeeId: emp.loginWithEmployeeId,
    isAllCustomerView:   emp.isAllCustomerView,
    isSR:                emp.isSR,
  };
}

export async function updateAccountSettings(
  id: string,
  actor: Actor,
  input: UpdateAccountSettingsInput,
): Promise<AccountSettingsDto> {
  await loadEmployee(id, actor);
  await db().employee.update({
    where: { id },
    data: { ...input, updatedById: actorUserId(actor) },
  });
  return getAccountSettings(id, actor);
}

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function getCredentials(id: string, actor: Actor): Promise<CredentialsDto> {
  const emp = await loadEmployee(id, actor);
  if (!emp.userId) {
    return { hasAccount: false, userId: null, phone: emp.mobile, roleId: null, roleName: null, userSystemRole: null, isActive: null, hideStockInSales: false };
  }
  const user = await db().user.findUnique({
    where: { id: emp.userId },
    include: { dynamicRole: { select: { id: true, name: true } } },
  });
  if (!user) {
    return { hasAccount: false, userId: null, phone: emp.mobile, roleId: null, roleName: null, userSystemRole: null, isActive: null, hideStockInSales: false };
  }
  return {
    hasAccount: true,
    userId: user.id,
    phone: user.phone,
    roleId: user.roleId,
    roleName: user.dynamicRole?.name ?? null,
    userSystemRole: user.role,
    isActive: user.isActive,
    hideStockInSales: user.hideStockInSales,
  };
}

export async function updateCredentials(
  id: string,
  actor: Actor,
  input: UpdateCredentialsInput,
): Promise<CredentialsDto> {
  const emp = await loadEmployee(id, actor);

  // Check phone uniqueness (excluding this employee's own user)
  const existing = await db().user.findUnique({ where: { phone: input.phone } });
  if (existing && existing.id !== emp.userId) {
    throw conflict("This phone number is already used by another account.");
  }

  const roleId = input.roleId || null;

  if (!emp.userId) {
    // Create new user account
    if (!input.password) {
      throw new AppError(400, "VALIDATION_ERROR", "Password is required when creating a new account.");
    }
    const passwordHash = await argon2.hash(input.password);
    const user = await db().user.create({
      data: {
        name:         emp.name,
        phone:        input.phone,
        passwordHash,
        roleId,
        hideStockInSales: input.hideStockInSales ?? false,
        isActive:     true,
        // Creating a login here is meant to let the employee sign in; page permissions are still granted separately.
        erpAccess:    true,
      },
    });
    await db().employee.update({
      where: { id },
      data: { userId: user.id, isUser: true, updatedById: actorUserId(actor) },
    });
  } else {
    // Update existing user
    const updateData: Record<string, unknown> = { phone: input.phone, roleId };
    if (input.hideStockInSales !== undefined) updateData.hideStockInSales = input.hideStockInSales;
    if (input.password) {
      updateData.passwordHash = await argon2.hash(input.password);
      // Invalidate all existing sessions so the user must re-login
      await db().userSession.deleteMany({ where: { userId: emp.userId } });
    }
    await db().user.update({ where: { id: emp.userId }, data: updateData });
  }

  return getCredentials(id, actor);
}

// ─── Org access ───────────────────────────────────────────────────────────────

export async function getOrgAccess(id: string, actor: Actor): Promise<OrgAccessDto> {
  const emp = await loadEmployee(id, actor);
  if (!emp.userId) {
    return { businessUnitIds: [], officeIds: [], warehouseIds: [], allBusinessUnits: false, allOffices: false, allWarehouses: false };
  }

  const [bus, offices, warehouses, flags] = await Promise.all([
    db().userBusinessUnitAccess.findMany({ where: { userId: emp.userId }, select: { businessUnitId: true } }),
    db().userOfficeAccess.findMany({ where: { userId: emp.userId }, select: { officeId: true } }),
    db().userWarehouseAccess.findMany({ where: { userId: emp.userId }, select: { warehouseId: true } }),
    db().user.findUnique({ where: { id: emp.userId }, select: { allBusinessUnits: true, allOffices: true, allWarehouses: true } }),
  ]);

  return {
    businessUnitIds:  bus.map((r) => r.businessUnitId),
    officeIds:        offices.map((r) => r.officeId),
    warehouseIds:     warehouses.map((r) => r.warehouseId),
    allBusinessUnits: flags?.allBusinessUnits ?? false,
    allOffices:       flags?.allOffices ?? false,
    allWarehouses:    flags?.allWarehouses ?? false,
  };
}

export async function updateOrgAccess(
  id: string,
  actor: Actor,
  input: UpdateOrgAccessInput,
): Promise<OrgAccessDto> {
  const emp = await loadEmployee(id, actor);
  if (!emp.userId) {
    throw new AppError(400, "VALIDATION_ERROR", "Employee must have an ERP account before assigning organizational access.");
  }
  const userId = emp.userId;

  // "All" stores a row for every current one too, so code reading the rows sees
  // them; ones created later are added by grantToAllAccessUsers.
  const all = (input.allBusinessUnits || input.allOffices || input.allWarehouses) ? await getOrgOptions(actor) : null;
  const businessUnitIds = input.allBusinessUnits && all ? all.businessUnits.map((u) => u.id) : input.businessUnitIds;
  const officeIds = input.allOffices && all ? all.offices.map((o) => o.id) : input.officeIds;
  const warehouseIds = input.allWarehouses && all ? all.warehouses.map((w) => w.id) : input.warehouseIds;

  await db().$transaction([
    db().user.update({
      where: { id: userId },
      data: { allBusinessUnits: input.allBusinessUnits, allOffices: input.allOffices, allWarehouses: input.allWarehouses },
    }),
    db().userBusinessUnitAccess.deleteMany({ where: { userId } }),
    db().userOfficeAccess.deleteMany({ where: { userId } }),
    db().userWarehouseAccess.deleteMany({ where: { userId } }),
    ...(businessUnitIds.length
      ? [db().userBusinessUnitAccess.createMany({ data: businessUnitIds.map((businessUnitId) => ({ userId, businessUnitId })) })]
      : []),
    ...(officeIds.length
      ? [db().userOfficeAccess.createMany({ data: officeIds.map((officeId) => ({ userId, officeId })) })]
      : []),
    ...(warehouseIds.length
      ? [db().userWarehouseAccess.createMany({ data: warehouseIds.map((warehouseId) => ({ userId, warehouseId })) })]
      : []),
  ]);

  return getOrgAccess(id, actor);
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function listRoles(): Promise<RoleDto[]> {
  const roles = await db().role.findMany({ orderBy: { name: "asc" } });
  return roles.map((r) => ({ id: r.id, name: r.name, description: r.description }));
}

export async function createRole(actor: Actor, input: CreateRoleInput): Promise<RoleDto> {
  const existing = await db().role.findUnique({ where: { name: input.name } });
  if (existing) throw conflict(`A role named "${input.name}" already exists.`);
  const role = await db().role.create({
    data: { name: input.name, description: input.description || null },
  });
  return { id: role.id, name: role.name, description: role.description };
}

// ─── Org options ──────────────────────────────────────────────────────────────

export async function getOrgOptions(actor: Actor): Promise<OrgOptionsDto> {
  const companyFilter =
    actor.companyScope === "ALL" ? {} : { companyId: { in: [...actor.companyScope] } };

  const [businessUnits, offices, warehouses] = await Promise.all([
    db().businessUnit.findMany({ where: companyFilter, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db().office.findMany({
      where: actor.companyScope === "ALL" ? {} : { businessUnit: companyFilter },
      select: { id: true, name: true, businessUnitId: true },
      orderBy: { name: "asc" },
    }),
    db().warehouse.findMany({
      where: actor.companyScope === "ALL" ? {} : { office: { businessUnit: companyFilter } },
      select: { id: true, name: true, officeId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { businessUnits, offices, warehouses };
}
