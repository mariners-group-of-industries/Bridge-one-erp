import { NextResponse } from "next/server";
import { canOn, type Actor } from "@/lib/auth/actor";
import { ACTION_LABELS, findFeature, type PermissionAction } from "./registry";

/**
 * In-handler check for rules the route-level check cannot see: an action chosen by
 * the request body (approving via PATCH, posting a voucher) or a shared API whose
 * records belong to different pages. Returns a 403 response, or null when allowed.
 */
export function denyUnless(actor: Actor, featureKey: string, action: PermissionAction): Response | null {
  if (actor.isMaster || canOn(actor, featureKey, action, "accounts:write")) return null;
  const page = findFeature(featureKey)?.label ?? featureKey;
  return NextResponse.json(
    {
      success: false,
      error: `You need the ${ACTION_LABELS[action]} permission on ${page} (Configuration › Permission Group).`,
      code: "FORBIDDEN",
      required: { feature: featureKey, action },
    },
    { status: 403 },
  );
}
