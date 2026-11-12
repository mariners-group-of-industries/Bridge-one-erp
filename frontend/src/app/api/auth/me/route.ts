import { NextResponse } from "next/server";
import { permissionsOf } from "@/features/configuration/security/access/server/access.service";
import { resolveActor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";

/**
 * The signed-in user with their effective permissions (["*"] = everything).
 * Goes through the same check as every API call, so an account whose access was
 * removed, suspended or deactivated gets 401 and is signed out.
 */
export async function GET(request: Request) {
  const actor = await resolveActor(request);
  if (!actor || actor.via !== "session") return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  const user = await db().user.findUnique({ where: { id: actor.id }, select: { phone: true } });
  if (!user) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  const name = actor.name ?? "";
  return NextResponse.json({
    id: actor.id,
    name,
    phone: user.phone,
    role: actor.role,
    initials: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    isMaster: actor.isMaster,
    permissions: permissionsOf(actor),
    hideStockInSales: actor.hideStockInSales ?? false,
  });
}
