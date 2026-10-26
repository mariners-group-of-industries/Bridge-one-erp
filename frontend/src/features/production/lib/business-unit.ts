import { badRequest, notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";

/** The business unit a new production record goes to: the one asked for, or the user's only one. */
export async function targetBusinessUnit(actor: Actor, businessUnitId?: string): Promise<string> {
  const unitIds = await scopedBusinessUnitIds(actor);
  if (businessUnitId) {
    if (!unitIds.includes(businessUnitId)) throw notFound("Business unit");
    return businessUnitId;
  }
  if (unitIds.length === 1) return unitIds[0];
  throw badRequest(unitIds.length === 0 ? "You have no business unit." : "Choose a business unit.");
}
