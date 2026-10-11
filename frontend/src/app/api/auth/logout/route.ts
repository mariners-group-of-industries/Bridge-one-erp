import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { verifyToken } from "@/lib/auth/jwt";
import { clearAuthCookie, getAuthCookie } from "@/lib/auth/cookies";

export async function POST() {
  const token = await getAuthCookie();
  if (token) {
    try {
      const { jti } = await verifyToken(token);
      await db().userSession.deleteMany({ where: { jti } });
    } catch {
      // Token already invalid — still clear the cookie
    }
  }
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
