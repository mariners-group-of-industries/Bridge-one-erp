import { z } from "zod";
import { PERMISSION_ACTIONS, type PermissionAction } from "@/lib/permissions/registry";
import type { PermissionSource } from "@/lib/permissions/resolve";

// Access control: permission groups and users' ERP access (Configuration › Identity & Security).

const action = z.enum(PERMISSION_ACTIONS as unknown as [PermissionAction, ...PermissionAction[]]);
const featureKey = z.string().min(1).max(200);

/** Granted actions per page: { "/sales/orders": ["view", "create"] }. */
const grantMap = z.record(featureKey, z.array(action).max(PERMISSION_ACTIONS.length));
export type GrantMap = Record<string, PermissionAction[]>;

export const GROUP_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const permissionGroupInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the group name.").max(150, "At most 150 characters."),
  code: z
    .string()
    .trim()
    .min(2, "Enter a code of at least 2 characters.")
    .max(60, "At most 60 characters.")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - and _ only.")
    .transform((v) => v.toUpperCase()),
  description: z.string().trim().max(500, "At most 500 characters.").optional().default(""),
  status: z.enum(GROUP_STATUSES).optional().default("ACTIVE"),
  grants: grantMap.optional().default({}),
});
export type PermissionGroupInput = z.input<typeof permissionGroupInputSchema>;

export const groupUsersInputSchema = z.object({
  userIds: z.array(z.uuid()).max(1000).refine((ids) => new Set(ids).size === ids.length, { message: "Each user can be added only once." }),
});

export const overrideSchema = z.object({ featureKey, action, effect: z.enum(["ALLOW", "DENY"]) });
export type OverrideInput = z.infer<typeof overrideSchema>;

export const userAccessInputSchema = z.object({
  erpAccess: z.boolean(),
  status: z.enum(USER_STATUSES),
  /** Only the master account may change it, and never on itself. */
  isMaster: z.boolean().optional(),
  groupIds: z.array(z.uuid()).max(100).refine((ids) => new Set(ids).size === ids.length, { message: "Each group can be added only once." }),
  overrides: z
    .array(overrideSchema)
    .max(5000)
    .refine((rows) => new Set(rows.map((r) => `${r.featureKey}:${r.action}`)).size === rows.length, { message: "Each permission can have one override." }),
});
export type UserAccessInput = z.input<typeof userAccessInputSchema>;

export const groupListQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  status: z.enum(["ALL", ...GROUP_STATUSES]).optional().default("ALL"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});
export type GroupListQuery = z.input<typeof groupListQuerySchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface PermissionGroupRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: (typeof GROUP_STATUSES)[number];
  fullAccess: boolean;
  /** Granted permissions (actions summed over pages). */
  permissionCount: number;
  userCount: number;
  createdBy: string | null;
  createdAt: string;
  lastActionBy: string | null;
  updatedAt: string;
}

export interface PermissionGroupList {
  rows: PermissionGroupRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PermissionGroupDto extends PermissionGroupRow {
  grants: GrantMap;
}

export interface AccessUser {
  id: string;
  name: string;
  phone: string;
  employeeCode: string | null;
  isMaster: boolean;
}

export interface UserAccessDto {
  user: AccessUser & { erpAccess: boolean; status: UserStatus; lastLoginAt: string | null };
  groupIds: string[];
  overrides: OverrideInput[];
  /** Groups the actor may assign (active and inactive, with what they grant). */
  groups: (Pick<PermissionGroupRow, "id" | "name" | "code" | "status" | "fullAccess"> & { grants: GrantMap; assignable: boolean })[];
  /** What the actor may change here. */
  editable: { access: boolean; master: boolean; reason: string | null };
}

export interface EffectivePermissionRow {
  featureKey: string;
  action: PermissionAction;
  granted: boolean;
  source: PermissionSource | "master";
  groups: string[];
}

export interface EffectivePermissionsDto {
  userId: string;
  isMaster: boolean;
  canSignIn: boolean;
  blockedReason: string | null;
  permissions: EffectivePermissionRow[];
}
