import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type { Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  // Pooled Neon connection string (host contains "-pooler") for app runtime.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. See .env.example.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Prisma's defaults (2s to start, 5s to run) are too tight for a remote
    // serverless database: a cold Neon compute plus TLS handshake can take
    // several seconds before the first statement runs.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  });
}

/**
 * Lazily-created Prisma client. Created on first use (not at import time) so
 * that builds and type generation do not require database credentials.
 */
export function db(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
