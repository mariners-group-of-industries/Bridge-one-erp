import { NextRequest, NextResponse } from "next/server";
import * as argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/prisma/client";
import { signToken } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/cookies";

const Body = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { phone, password } = parsed.data;

    const user = await db().user.findUnique({ where: { phone } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid phone number or password." }, { status: 401 });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
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

    return NextResponse.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      initials: user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    });
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
