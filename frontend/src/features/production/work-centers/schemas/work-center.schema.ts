import { z } from "zod";

const name = (label: string, max = 100) =>
  z.string({ error: `${label} is required.` }).trim().min(1, { error: `${label} is required.` }).max(max, { error: `${label} is too long.` });
const optionalId = z.uuid().nullish();
const positive = (label: string, max: number) =>
  z.number({ error: `${label} is required.` }).refine(Number.isFinite, { error: `${label} must be a number.` }).gt(0, { error: `${label} must be more than 0.` }).max(max, { error: `${label} is too large.` });

/** Body of POST /api/production/work-centers and `data` of PUT (shared by the route and the browser). */
export const workCenterInputSchema = z
  .object({
    /** Needed only when the user has more than one business unit. */
    businessUnitId: z.uuid().optional(),
    name: name("Work Center Name", 150),
    typeId: z.uuid({ error: "Work Center Type is required." }),
    code: name("Work Center Code", 30),
    standardRunHour: positive("Standard Run Hour", 24),
    capacityPerHour: positive("Standard Capacity Per Hour", 99_999_999_999),
    ratedCapacityPerHour: positive("Rated Capacity Per Hour", 99_999_999_999),
    costPerHour: z.number().refine(Number.isFinite, { error: "Cost Per Hour must be a number." }).min(0, { error: "Cost Per Hour cannot be negative." }).max(999_999_999_999).nullish(),
    remarks: z.string().trim().max(500, { error: "Remarks is too long." }).nullish(),
    departmentId: optionalId,
    departmentSectionId: optionalId,
    warehouseId: optionalId,
    operatorIds: z.array(z.uuid()).max(200).default([]),
  })
  .refine((input) => !input.departmentSectionId || input.departmentId, {
    error: "Choose the department of this section.",
    path: ["departmentId"],
  })
  .refine((input) => new Set(input.operatorIds).size === input.operatorIds.length, {
    error: "An operator is tagged twice.",
    path: ["operatorIds"],
  });
export type WorkCenterInput = z.input<typeof workCenterInputSchema>;

/** PUT body: optimistic lock on `updatedAt`. */
export const workCenterUpdateSchema = z.object({ version: z.iso.datetime(), data: workCenterInputSchema });
export type WorkCenterUpdate = z.input<typeof workCenterUpdateSchema>;

export const workCenterStatusSchema = z.object({ version: z.iso.datetime(), isActive: z.boolean() });

/** Filters of GET /api/production/work-centers. */
export const workCenterListQuerySchema = z.object({
  typeId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  departmentSectionId: z.uuid().optional(),
});
export type WorkCenterListQuery = z.input<typeof workCenterListQuerySchema>;

export const MASTER_KINDS = ["types", "departments", "sections"] as const;
export type MasterKind = (typeof MASTER_KINDS)[number];

/** Body of POST /api/production/work-center-masters/[kind] ("ADD NEW"). */
export const masterInputSchema = z.object({
  businessUnitId: z.uuid().optional(),
  name: name("Name"),
  /** Sections only. */
  departmentId: z.uuid().optional(),
});
export type MasterInput = z.input<typeof masterInputSchema>;

export interface Option {
  id: string;
  name: string;
}

export interface WorkCenterLookups {
  businessUnits: Option[];
  types: (Option & { businessUnitId: string })[];
  departments: (Option & { businessUnitId: string })[];
  sections: (Option & { departmentId: string })[];
  warehouses: (Option & { officeName: string; businessUnitId: string })[];
  employees: { id: string; code: string; name: string; designation: string | null; department: string | null; businessUnitId: string }[];
}

export interface WorkCenterOperator {
  employeeId: string;
  code: string;
  name: string;
  designation: string | null;
  department: string | null;
}

export interface WorkCenterRow {
  id: string;
  businessUnitId: string;
  code: string;
  name: string;
  typeId: string;
  typeName: string;
  departmentId: string | null;
  departmentName: string | null;
  departmentSectionId: string | null;
  sectionName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  standardRunHour: number;
  capacityPerHour: number;
  ratedCapacityPerHour: number;
  costPerHour: number | null;
  remarks: string | null;
  isActive: boolean;
  operatorCount: number;
  updatedAt: string;
}

export interface WorkCenterDetail extends WorkCenterRow {
  operators: WorkCenterOperator[];
}
