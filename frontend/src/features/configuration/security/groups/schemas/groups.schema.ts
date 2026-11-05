import { z } from "zod";

// User Group (Configuration › Identity & Security).

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
