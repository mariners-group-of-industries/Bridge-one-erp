"use client";

import { useMemo } from "react";
import { useSession } from "@/lib/auth/session";
import { ACTION_LABELS, PERMISSION_ACTIONS, type PermissionAction } from "./registry";

export type FeaturePermissions = Record<PermissionAction, boolean>;

/**
 * What the signed-in user may do on one page (Configuration › Permission Group).
 * The server enforces the same rules (api-rules.ts); this only hides or disables
 * controls the user cannot use.
 */
export function useFeaturePermissions(featureKey: string): FeaturePermissions {
  const { can } = useSession();
  return useMemo(
    () => Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, can(featureKey, a)])) as FeaturePermissions,
    [can, featureKey],
  );
}

/** Tooltip for a control disabled for lack of a permission. */
export const needsPermission = (action: PermissionAction) => `Requires ${ACTION_LABELS[action]} permission in Configuration`;
