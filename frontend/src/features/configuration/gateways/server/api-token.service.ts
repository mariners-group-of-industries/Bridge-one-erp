import { AppError, notFound } from "@/lib/api/errors";
import { generateToken } from "@/lib/auth/api-token";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import { generateTokenSchema, type ApiTokenRow, type GeneratedToken, type GenerateTokenInput } from "../schemas/api-token.schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tokens are managed by signed-in people only, never by another token. */
function assertPerson(actor: Actor) {
  if (actor.role === "API") throw new AppError(403, "FORBIDDEN", "API tokens cannot manage API tokens. Sign in to do this.");
}

type TokenRecord = Awaited<ReturnType<ReturnType<typeof db>["apiToken"]["findFirstOrThrow"]>>;

function toRow(record: TokenRecord, now = new Date()): ApiTokenRow {
  return {
    id: record.id,
    name: record.name,
    tokenPrefix: record.tokenPrefix,
    access: record.access === "READ_WRITE" ? "READ_WRITE" : "READ",
    status: record.revokedAt ? "REVOKED" : record.expiresAt && record.expiresAt <= now ? "EXPIRED" : "ACTIVE",
    createdByName: record.createdByName,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
  };
}

export async function listApiTokens(actor: Actor): Promise<ApiTokenRow[]> {
  assertPerson(actor);
  const records = await db().apiToken.findMany({ orderBy: { createdAt: "desc" } });
  return records.map((r) => toRow(r));
}

export async function createApiToken(actor: Actor, input: GenerateTokenInput): Promise<GeneratedToken> {
  assertPerson(actor);
  const data = generateTokenSchema.parse(input);
  const { token, hash, prefix } = generateToken();
  const expiresAt = data.expiry === "never" ? null : new Date(Date.now() + Number(data.expiry) * 86_400_000);
  const createdByName = actor.name ?? (UUID.test(actor.id) ? (await db().user.findUnique({ where: { id: actor.id }, select: { name: true } }))?.name : null) ?? "Administrator";
  const record = await db().apiToken.create({
    data: { name: data.name, tokenPrefix: prefix, tokenHash: hash, access: data.access, expiresAt, createdById: actor.id, createdByName },
  });
  return { ...toRow(record), token };
}

export async function revokeApiToken(actor: Actor, id: string): Promise<ApiTokenRow> {
  assertPerson(actor);
  const record = await db().apiToken.findUnique({ where: { id } });
  if (!record) throw notFound("API token");
  if (record.revokedAt) return toRow(record);
  return toRow(await db().apiToken.update({ where: { id }, data: { revokedAt: new Date() } }));
}

export async function deleteApiToken(actor: Actor, id: string): Promise<void> {
  assertPerson(actor);
  const { count } = await db().apiToken.deleteMany({ where: { id } });
  if (count === 0) throw notFound("API token");
}
