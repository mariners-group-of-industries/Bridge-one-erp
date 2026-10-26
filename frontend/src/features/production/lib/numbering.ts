import type { Prisma } from "@/generated/prisma/client";
import { companyDocumentNumber } from "@/features/sales/lib/sequence";

/** Next production document number, e.g. "PRO-" → "PRO-MG260000001" (see companyDocumentNumber). */
export const productionNumber = (tx: Prisma.TransactionClient, businessUnitId: string, docType: string, prefix: string, date: string) =>
  companyDocumentNumber(tx, businessUnitId, docType, prefix, date);
