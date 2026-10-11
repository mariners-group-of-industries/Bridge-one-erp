import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Issues the next number of a sequence inside the caller's transaction. The
 * upsert runs as one INSERT … ON CONFLICT DO UPDATE, so concurrent requests
 * get distinct numbers.
 */
export async function nextNumber(tx: Tx, businessUnitId: string, docType: string, year: number): Promise<number> {
  const sequence = await tx.documentSequence.upsert({
    where: { businessUnitId_docType_year: { businessUnitId, docType, year } },
    create: { businessUnitId, docType, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return sequence.lastNumber;
}

/** "SQ" + 2026 + 7 → "SQ-2026-00007"; year 0 → "CUST-00007". */
export function formatNumber(prefix: string, year: number, value: number): string {
  const serial = String(value).padStart(5, "0");
  return year ? `${prefix}-${year}-${serial}` : `${prefix}-${serial}`;
}
