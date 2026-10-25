import { z } from "zod";
import { UUID_PATTERN } from "@/lib/validation/fields";

// ─── Personal info (GET + PATCH) ─────────────────────────────────────────────

export const updatePersonalInfoSchema = z.object({
  employeeCode:     z.string().trim().max(30).optional().or(z.literal("")),
  name:             z.string().trim().min(1).max(150),
  attendanceId:     z.string().trim().max(30).optional().or(z.literal("")),
  designation:      z.string().trim().max(100).optional().or(z.literal("")),
  hrPosition:       z.string().trim().max(100).optional().or(z.literal("")),
  department:       z.string().trim().max(100).optional().or(z.literal("")),
  departmentSection:z.string().trim().max(100).optional().or(z.literal("")),
  employeeType:     z.string().trim().max(50).optional().or(z.literal("")),
  serviceCategory:  z.string().trim().max(100).optional().or(z.literal("")),
  employeePolicy:   z.string().trim().max(100).optional().or(z.literal("")),
  location:         z.string().trim().max(150).optional().or(z.literal("")),
  joiningDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  terminationDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  mobile:           z.string().trim().max(30).optional().or(z.literal("")),
  email:            z.string().trim().email().max(254).optional().or(z.literal("")),
  officialContact:  z.string().trim().max(30).optional().or(z.literal("")),
  religion:         z.string().trim().max(50).optional().or(z.literal("")),
  gender:           z.string().trim().max(20).optional().or(z.literal("")),
  bloodGroup:       z.string().trim().max(10).optional().or(z.literal("")),
  dateOfBirth:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  fathersName:      z.string().trim().max(150).optional().or(z.literal("")),
  mothersName:      z.string().trim().max(150).optional().or(z.literal("")),
  nidNumber:        z.string().trim().max(30).optional().or(z.literal("")),
  presentAddress:   z.string().trim().max(500).optional().or(z.literal("")),
  permanentAddress: z.string().trim().max(500).optional().or(z.literal("")),
  supervisor:       z.string().trim().max(150).optional().or(z.literal("")),
  lineManager:      z.string().trim().max(150).optional().or(z.literal("")),
});

export type UpdatePersonalInfoInput = z.infer<typeof updatePersonalInfoSchema>;

export interface PersonalInfoDto {
  id: string;
  employeeCode: string;
  attendanceId: string | null;
  name: string;
  designation: string | null;
  hrPosition: string | null;
  department: string | null;
  departmentSection: string | null;
  employeeType: string | null;
  serviceCategory: string | null;
  employeePolicy: string | null;
  location: string | null;
  joiningDate: string;
  confirmationDate: string | null;
  terminationDate: string | null;
  mobile: string | null;
  email: string | null;
  officialContact: string | null;
  religion: string | null;
  gender: string | null;
  bloodGroup: string | null;
  dateOfBirth: string | null;
  fathersName: string | null;
  mothersName: string | null;
  nidNumber: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  supervisor: string | null;
  lineManager: string | null;
  officeName: string;
}

// ─── Account settings (GET + PATCH) ──────────────────────────────────────────

export const updateAccountSettingsSchema = z.object({
  holdSalary:          z.boolean(),
  departmentApproval:  z.boolean(),
  isService:           z.boolean(),
  holdPayment:         z.boolean(),
  isReseller:          z.boolean(),
  isUser:              z.boolean(),
  isMasterUser:        z.boolean(),
  loginWithEmployeeId: z.boolean(),
  isAllCustomerView:   z.boolean(),
  isSR:                z.boolean(),
});

export type UpdateAccountSettingsInput = z.infer<typeof updateAccountSettingsSchema>;

export interface AccountSettingsDto {
  holdSalary:          boolean;
  departmentApproval:  boolean;
  isService:           boolean;
  holdPayment:         boolean;
  isReseller:          boolean;
  isUser:              boolean;
  isMasterUser:        boolean;
  loginWithEmployeeId: boolean;
  isAllCustomerView:   boolean;
  isSR:                boolean;
}

// ─── ERP login / credentials (GET + PATCH) ───────────────────────────────────

export const updateCredentialsSchema = z.object({
  phone:    z.string().trim().min(1).max(30),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
  confirmPassword: z.string().optional().or(z.literal("")),
  roleId:   z.string().regex(UUID_PATTERN, { message: "Invalid UUID" }).optional().or(z.literal("")),
}).refine(
  (d) => !d.password || d.password === d.confirmPassword,
  { message: "Passwords do not match.", path: ["confirmPassword"] },
).refine(
  (d) => !d.password || /[A-Z]/.test(d.password),
  { message: "Password must contain at least one uppercase letter.", path: ["password"] },
).refine(
  (d) => !d.password || /[0-9]/.test(d.password),
  { message: "Password must contain at least one number.", path: ["password"] },
).refine(
  (d) => !d.password || /[^A-Za-z0-9]/.test(d.password),
  { message: "Password must contain at least one special character.", path: ["password"] },
);

export type UpdateCredentialsInput = z.infer<typeof updateCredentialsSchema>;

export interface CredentialsDto {
  hasAccount: boolean;
  phone: string | null;
  roleId: string | null;
  roleName: string | null;
  userSystemRole: string | null;
  isActive: boolean | null;
}

// ─── Org access (GET + PUT) ───────────────────────────────────────────────────

export const updateOrgAccessSchema = z.object({
  businessUnitIds: z.array(z.string().regex(UUID_PATTERN, { message: "Invalid UUID" })),
  officeIds:       z.array(z.string().regex(UUID_PATTERN, { message: "Invalid UUID" })),
  warehouseIds:    z.array(z.string().regex(UUID_PATTERN, { message: "Invalid UUID" })),
});

export type UpdateOrgAccessInput = z.infer<typeof updateOrgAccessSchema>;

export interface OrgAccessDto {
  businessUnitIds: string[];
  officeIds:       string[];
  warehouseIds:    string[];
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  name:        z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export interface RoleDto {
  id:          string;
  name:        string;
  description: string | null;
}

// ─── Org options (for dropdowns) ─────────────────────────────────────────────

export interface OrgOptionsDto {
  businessUnits: { id: string; name: string }[];
  offices:       { id: string; name: string; businessUnitId: string }[];
  warehouses:    { id: string; name: string; officeId: string }[];
}
