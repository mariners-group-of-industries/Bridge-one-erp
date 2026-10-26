import { z } from "zod";
import type { CompanyDateFormat } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/validation/fields";

// ─── Listing query ───────────────────────────────────────────────────────────

export const EMPLOYEE_PAGE_SIZES = [10, 25, 50, 100] as const;
export const EMPLOYEE_EXPORT_PAGE_SIZE = 100_000;
export const DEFAULT_EMPLOYEE_PAGE_SIZE = 10;

export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_SORT_FIELDS = ["employeeCode", "name", "joiningDate", "updatedAt"] as const;

export interface FilterOption {
  value: string;
  label: string;
}

export const VIEW_BY_OPTIONS: readonly FilterOption[] = [];

const emptyToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value) => (EMPLOYEE_PAGE_SIZES as readonly number[]).includes(value) || value === EMPLOYEE_EXPORT_PAGE_SIZE,
      { message: `Page size must be one of ${EMPLOYEE_PAGE_SIZES.join(", ")}.` },
    )
    .default(DEFAULT_EMPLOYEE_PAGE_SIZE),
  search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  viewBy: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
  userType: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(EMPLOYEE_STATUSES).optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(EMPLOYEE_SORT_FIELDS).default("employeeCode")),
  order: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("asc")),
});

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
export type EmployeeListParams = Partial<z.input<typeof employeeListQuerySchema>>;

// ─── DTOs ────────────────────────────────────────────────────────────────────

export type EmployeeUserRole = "ADMINISTRATOR" | "MANAGER" | "STAFF";

export interface EmployeeListRow {
  id: string;
  employeeCode: string;
  attendanceId: string | null;
  name: string;
  designation: string | null;
  department: string | null;
  officeName: string;
  joiningDate: string;
  terminationDate: string | null;
  mobile: string | null;
  employeeType: string | null;
  userRole: EmployeeUserRole | null;
  lastActionBy: string | null;
  lastActionAt: string;
  isActive: boolean;
  dateFormat: CompanyDateFormat;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export interface EmployeeList {
  rows: EmployeeListRow[];
  pagination: Pagination;
}

export interface EmployeeFilterOptions {
  employeeTypes: string[];
}

// ─── Create ──────────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  employeeCode:      z.string().trim().min(1).max(30),
  attendanceId:      z.string().trim().max(30).optional(),
  name:              z.string().trim().min(1).max(150),
  officeId:          z.string().regex(UUID_PATTERN, { message: "Invalid UUID" }),
  designation:       z.string().trim().max(100).optional(),
  hrPosition:        z.string().trim().max(100).optional(),
  department:        z.string().trim().max(100).optional(),
  departmentSection: z.string().trim().max(100).optional(),
  employeeType:      z.string().trim().max(50).optional(),
  serviceCategory:   z.string().trim().max(100).optional(),
  employeePolicy:    z.string().trim().max(100).optional(),
  location:          z.string().trim().max(150).optional(),
  joiningDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmationDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  terminationDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mobile:            z.string().trim().max(30).optional(),
  email:             z.string().trim().email().max(254).optional().or(z.literal("")),
  officialContact:   z.string().trim().max(30).optional(),
  religion:          z.string().trim().max(50).optional(),
  gender:            z.string().trim().max(20).optional(),
  bloodGroup:        z.string().trim().max(10).optional(),
  dateOfBirth:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fathersName:       z.string().trim().max(150).optional(),
  mothersName:       z.string().trim().max(150).optional(),
  nidNumber:         z.string().trim().max(30).optional(),
  presentAddress:    z.string().trim().max(500).optional(),
  permanentAddress:  z.string().trim().max(500).optional(),
  supervisor:        z.string().trim().max(150).optional(),
  lineManager:       z.string().trim().max(150).optional(),
  // flags
  holdSalary:        z.boolean().default(false),
  departmentApproval:z.boolean().default(false),
  isService:         z.boolean().default(false),
  holdPayment:       z.boolean().default(false),
  isReseller:        z.boolean().default(false),
  isUser:            z.boolean().default(false),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export interface CreateEmployeeResult {
  id: string;
  employeeCode: string;
}

// ─── Form options ─────────────────────────────────────────────────────────────

export interface EmployeeFormOptions {
  offices:       { id: string; name: string }[];
  designations:  string[];
  hrPositions:   string[];
  departments:   string[];
  departmentSections: string[];
  employeeTypes: string[];
  serviceCategories: string[];
  employeePolicies:  string[];
  supervisors:   string[];
  lineManagers:  string[];
}

export const RELIGION_OPTIONS   = ["Islam", "Hinduism", "Christianity", "Buddhism", "Others"] as const;
export const GENDER_OPTIONS     = ["Male", "Female", "Other"] as const;
export const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const USER_ROLE_LABELS: Record<EmployeeUserRole, string> = {
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  STAFF: "Staff",
};
