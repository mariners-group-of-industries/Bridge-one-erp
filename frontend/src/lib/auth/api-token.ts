import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/prisma/client";
import { ALL_PERMISSIONS, type Actor, type Permission } from "./actor";

/** Tokens look like `b1_<43 url-safe chars>`; only their SHA-256 is stored. */
export const TOKEN_PREFIX = "b1_";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 11) };
}

/**
 * Actor for an `Authorization: Bearer b1_…` header, or null when the header is
 * missing, malformed, unknown, revoked or expired. READ tokens get the read
 * permissions, and only for GET/HEAD requests.
 */
export async function resolveTokenActor(authorization: string | null, method = "GET"): Promise<Actor | null> {
  const match = authorization?.match(/^Bearer\s+(b1_[A-Za-z0-9_-]{20,100})$/);
  if (!match) return null;
  const record = await db().apiToken.findUnique({ where: { tokenHash: hashToken(match[1]) } });
  const now = new Date();
  if (!record || record.revokedAt || (record.expiresAt && record.expiresAt <= now)) return null;
  // Usage is recorded at most once a minute per token.
  if (!record.lastUsedAt || now.getTime() - record.lastUsedAt.getTime() > 60_000) {
    await db()
      .apiToken.update({ where: { id: record.id }, data: { lastUsedAt: now } })
      .catch(() => undefined);
  }
  return {
    id: `token:${record.id}`,
    name: `API token: ${record.name}`,
    role: "API",
    isMaster: false,
    // READ tokens may only read: any other method gets no permissions (403).
    permissions: new Set<Permission>(record.access === "READ_WRITE" ? ALL_PERMISSIONS : ["GET", "HEAD"].includes(method.toUpperCase()) ? ALL_PERMISSIONS.filter((p) => p.endsWith(":read")) : []),
    companyScope: "ALL",
  };
}
