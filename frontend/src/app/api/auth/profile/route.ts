import { NextRequest, NextResponse } from "next/server";
import * as argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/prisma/client";
import { verifyToken } from "@/lib/auth/jwt";
import { getAuthCookie } from "@/lib/auth/cookies";

async function getAuthedUser() {
  const token = await getAuthCookie();
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    const session = await db().userSession.findUnique({ where: { jti: payload.jti } });
    if (!session || session.expiresAt < new Date()) return null;
    return await db().user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isMaster: user.isMaster,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    initials: user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
  });
}

const UpdateBody = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().min(1).max(30),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  const parsed = UpdateBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const { name, phone } = parsed.data;
  if (phone !== user.phone) {
    const existing = await db().user.findUnique({ where: { phone } });
    if (existing) return NextResponse.json({ error: "Phone number already in use." }, { status: 409 });
  }

  const updated = await db().user.update({ where: { id: user.id }, data: { name, phone } });
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    phone: updated.phone,
    role: updated.role,
    initials: updated.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
  });
}

const PasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PUT(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  const parsed = PasswordBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const { currentPassword, newPassword } = parsed.data;
  const valid = await argon2.verify(user.passwordHash, currentPassword);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const passwordHash = await argon2.hash(newPassword);
  await db().user.update({ where: { id: user.id }, data: { passwordHash } });
  return NextResponse.json({ success: true });
}
