import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { verifyToken } from "@/lib/auth/jwt";
import { getAuthCookie } from "@/lib/auth/cookies";

export async function GET() {
  const token = await getAuthCookie();
  if (!token) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  try {
    const payload = await verifyToken(token);

    // Check session not revoked
    const session = await db().userSession.findUnique({ where: { jti: payload.jti } });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    return NextResponse.json({
      id: payload.sub,
      name: payload.name,
      phone: payload.phone,
      role: payload.role,
      initials: payload.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }
}
