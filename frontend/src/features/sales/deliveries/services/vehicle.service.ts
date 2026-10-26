import type { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { requireBusinessUnit, scopedBusinessUnitIds } from "../../lib/scope";
import { driverQuerySchema, vehicleInputSchema, type DriverOption, type VehicleOption } from "../schemas/vehicle.schema";

const vehicleSelect = {
  id: true,
  businessUnitId: true,
  vehicleNumber: true,
  vehicleSize: true,
  chassisNumber: true,
  vehicleName: true,
  serviceProvider: true,
  contactNumber: true,
  isRent: true,
  isCargo: true,
  driverEmployeeId: true,
  driverName: true,
  driverContact: true,
  securityCode: true,
  driver: { select: { name: true } },
  compartments: { orderBy: { compartmentNo: "asc" } },
} satisfies Prisma.VehicleSelect;

type VehicleRecord = Prisma.VehicleGetPayload<{ select: typeof vehicleSelect }>;

function toOption(record: VehicleRecord): VehicleOption {
  return {
    id: record.id,
    businessUnitId: record.businessUnitId,
    vehicleNumber: record.vehicleNumber,
    vehicleSize: record.vehicleSize,
    chassisNumber: record.chassisNumber,
    vehicleName: record.vehicleName,
    serviceProvider: record.serviceProvider,
    contactNumber: record.contactNumber,
    isRent: record.isRent,
    isCargo: record.isCargo,
    driverEmployeeId: record.driverEmployeeId,
    driverEmployeeName: record.driver?.name ?? null,
    driverName: record.driverName,
    driverContact: record.driverContact,
    securityCode: record.securityCode,
    compartments: record.compartments.map((compartment) => ({
      compartmentNo: compartment.compartmentNo,
      compartmentType: compartment.compartmentType,
      compartmentName: compartment.compartmentName,
      capacity: compartment.capacity.toNumber(),
      uom: compartment.uom,
    })),
  };
}

/** Active vehicles of the business units in scope (or one of them). */
export async function listVehicles(actor: Actor, businessUnitId?: string): Promise<VehicleOption[]> {
  const unitIds = await scopedBusinessUnitIds(actor, businessUnitId);
  const rows = await db().vehicle.findMany({
    where: { businessUnitId: { in: unitIds }, isActive: true },
    select: vehicleSelect,
    orderBy: { vehicleNumber: "asc" },
  });
  return rows.map(toOption);
}

/** A driver must be an active employee of an office of the business unit. */
export async function requireDriver(businessUnitId: string, employeeId: string, client: Prisma.TransactionClient | ReturnType<typeof db> = db()) {
  const employee = await client.employee.findFirst({
    where: { id: employeeId, isActive: true, office: { businessUnitId } },
    select: { id: true, name: true, mobile: true },
  });
  if (!employee) throw badRequest("Driver must be an active employee of this business unit.");
  return employee;
}

export async function createVehicle(actor: Actor, raw: unknown): Promise<VehicleOption> {
  const input = vehicleInputSchema.parse(raw);
  await requireBusinessUnit(actor, input.businessUnitId);
  if (input.driverEmployeeId) await requireDriver(input.businessUnitId, input.driverEmployeeId);
  const existing = await db().vehicle.findFirst({
    where: { businessUnitId: input.businessUnitId, vehicleNumber: { equals: input.vehicleNumber, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) throw conflict(`Vehicle ${input.vehicleNumber} already exists.`);
  const { compartments, ...vehicle } = input;
  const created = await db().vehicle.create({
    data: {
      ...vehicle,
      createdBy: actor.id,
      compartments: { create: compartments.map((compartment, index) => ({ ...compartment, compartmentNo: index + 1 })) },
    },
    select: vehicleSelect,
  });
  return toOption(created);
}

/** Driver (Employee) search: at least 3 letters of the name, code or mobile. */
export async function searchDrivers(actor: Actor, raw: unknown): Promise<DriverOption[]> {
  const { businessUnitId, search } = driverQuerySchema.parse(raw);
  await requireBusinessUnit(actor, businessUnitId);
  const rows = await db().employee.findMany({
    where: {
      isActive: true,
      office: { businessUnitId },
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
      ],
    },
    select: { id: true, employeeCode: true, name: true, mobile: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map((row) => ({ id: row.id, code: row.employeeCode, name: row.name, mobile: row.mobile }));
}
