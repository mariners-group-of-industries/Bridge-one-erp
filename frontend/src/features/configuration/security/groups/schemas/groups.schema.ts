import { z } from "zod";

// User Group and Permission Group (Configuration › Identity & Security).

export const PERMISSION_ACTIONS = [
  { key: "canCreate", label: "Create" },
  { key: "canEdit", label: "Edit" },
  { key: "canView", label: "View" },
  { key: "canDelete", label: "Delete" },
  { key: "canApprove", label: "Approve" },
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]["key"];

const groupName = z.string().trim().min(1, "Enter the group name.").max(150, "At most 150 characters.");

export const userGroupInputSchema = z.object({
  name: groupName,
  userIds: z
    .array(z.uuid("Select a user in every row."))
    .min(1, "Add at least one user.")
    .max(500, "At most 500 users per group.")
    .refine((ids) => new Set(ids).size === ids.length, { message: "Each user can be added only once." }),
});
export type UserGroupInput = z.input<typeof userGroupInputSchema>;

export const permissionEntrySchema = z.object({
  activityKey: z.string().min(1).max(200),
  canCreate: z.boolean().optional().default(false),
  canEdit: z.boolean().optional().default(false),
  canView: z.boolean().optional().default(false),
  canDelete: z.boolean().optional().default(false),
  canApprove: z.boolean().optional().default(false),
});
export type PermissionEntry = z.output<typeof permissionEntrySchema>;

export const permissionGroupInputSchema = z.object({
  name: groupName,
  entries: z
    .array(permissionEntrySchema)
    .max(1000)
    .refine((rows) => new Set(rows.map((r) => r.activityKey)).size === rows.length, { message: "Each activity can appear only once." }),
});
export type PermissionGroupInput = z.input<typeof permissionGroupInputSchema>;

export const groupListQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});
export type GroupListQuery = z.input<typeof groupListQuerySchema>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface GroupRow {
  id: string;
  name: string;
  /** Users in a user group, granted activities in a permission group. */
  count: number;
  lastActionBy: string | null;
  lastActionAt: string;
}

export interface GroupList {
  rows: GroupRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserOption {
  id: string;
  name: string;
  employeeCode: string | null;
}

export interface UserGroupDto {
  id: string;
  name: string;
  members: UserOption[];
}

export interface PermissionGroupDto {
  id: string;
  name: string;
  entries: PermissionEntry[];
}
