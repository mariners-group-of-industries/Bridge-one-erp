import type { Prisma } from "@/generated/prisma/client";
import { nextNumber } from "@/features/sales/lib/sequence";

/**
 * Next production document number: prefix + company initials + 2-digit year + 7-digit
 * serial per business unit and year, e.g. "PRO-" → "PRO-MG260000001". Runs in the
 * caller's transaction, so concurrent saves get distinct numbers.
 */
export async function productionNumber(tx: Prisma.TransactionClient, businessUnitId: string, docType: string, prefix: string, date: string) {
  const year = Number(date.slice(0, 4));
  const unit = await tx.businessUnit.findUniqueOrThrow({ where: { id: businessUnitId }, select: { company: { select: { name: true } } } });
  const initials =
    unit.company.name
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z]/g, "").charAt(0))
      .join("")
      .slice(0, 3)
      .toUpperCase() || "PR";
  const serial = await nextNumber(tx, businessUnitId, docType, year);
  return `${prefix}${initials}${String(year).slice(-2)}${String(serial).padStart(7, "0")}`;
}
