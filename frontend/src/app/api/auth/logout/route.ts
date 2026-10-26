import { NextResponse } from "next/server";
import { db } from "@/lib/prisma/client";
import { verifyToken } from "@/lib/auth/jwt";
import { clearAuthCookie, getAuthCookie } from "@/lib/auth/cookies";
import { clientOf, recordAudit } from "@/lib/audit/record";

export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (token) {
    try {
      const { jti, sub, name } = await verifyToken(token);
      await db().userSession.deleteMany({ where: { jti } });
      await recordAudit({ feature: "Authentication", actionType: "LOGOUT", userId: sub, userName: name, method: "POST", path: "/api/auth/logout", status: 200, ...clientOf(request) });
    } catch {
      // Token already invalid — still clear the cookie
    }
  }
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
