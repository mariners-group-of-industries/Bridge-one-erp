import { NextRequest, NextResponse } from "next/server";
import * as argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/prisma/client";
import { signToken } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/cookies";
import { clientOf, recordAudit } from "@/lib/audit/record";

const Body = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { phone, password } = parsed.data;

  const user = await db().user.findUnique({ where: { phone } });
  // Failed attempts are audited by account (never by the typed phone number).
  const audit = (actionType: "LOGIN" | "LOGIN_FAILED", status: number) =>
    recordAudit({ feature: "Authentication", actionType, userId: user?.id ?? null, userName: user?.name ?? "Unknown user", method: "POST", path: "/api/auth/login", status, ...clientOf(req) });
  if (!user || !user.isActive) {
    await audit("LOGIN_FAILED", 401);
    return NextResponse.json({ error: "Invalid phone number or password." }, { status: 401 });
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    await audit("LOGIN_FAILED", 401);
    return NextResponse.json({ error: "Invalid phone number or password." }, { status: 401 });
  }

  const { token, jti, expiresAt } = await signToken({
    sub: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isMaster: user.isMaster,
  });

  // Persist session for revocation support
  await db().userSession.create({ data: { userId: user.id, jti, expiresAt } });

  // Update last login
  await db().user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await setAuthCookie(token, expiresAt);
  await audit("LOGIN", 200);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    initials: user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
  });
}
