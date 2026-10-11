import { badRequest } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db, type Prisma } from "@/lib/prisma/client";
import {
  documentTypeBelongsTo,
  type CreateTermData,
  type ReorderTermsInput,
  type TermsDocumentType,
  type TermsDomain,
  type UpdateTermInput,
} from "../schemas/terms.schema";
import type { TermDto } from "../types";
import { loadBusinessUnit, loadTerm } from "./access";

const termInclude = { applicability: { select: { documentType: true } } } as const;
type TermRow = Prisma.TermsConditionGetPayload<{ include: typeof termInclude }>;

function toDto(term: TermRow): TermDto {
  return {
    id: term.id,
    businessUnitId: term.businessUnitId,
    domain: term.domain,
    content: term.content,
    isDefault: term.isDefault,
    sortOrder: term.sortOrder,
    documentTypes: term.applicability.map((row) => row.documentType),
    updatedAt: term.updatedAt.toISOString(),
  };
}

const termOrder = [{ sortOrder: "asc" }, { createdAt: "asc" }] satisfies
  Prisma.TermsConditionOrderByWithRelationInput[];

function assertDocumentTypes(domain: TermsDomain, types: readonly TermsDocumentType[]) {
  if (!types.every((type) => documentTypeBelongsTo(domain, type))) {
    throw badRequest("One or more document types do not belong to this terms domain.");
  }
}

/** Rewrites sortOrder as 1..n, preserving the current order. */
async function renumber(tx: Prisma.TransactionClient, businessUnitId: string, domain: TermsDomain) {
  const terms = await tx.termsCondition.findMany({
    where: { businessUnitId, domain },
    orderBy: termOrder,
    select: { id: true, sortOrder: true },
  });
  for (const [index, term] of terms.entries()) {
    if (term.sortOrder !== index + 1) {
      await tx.termsCondition.update({ where: { id: term.id }, data: { sortOrder: index + 1 } });
    }
  }
}

export async function listTerms(
  actor: Actor,
  businessUnitId: string,
  domain: TermsDomain,
): Promise<TermDto[]> {
  await loadBusinessUnit(actor, businessUnitId);
  const terms = await db().termsCondition.findMany({
    where: { businessUnitId, domain },
    include: termInclude,
    orderBy: termOrder,
  });
  return terms.map(toDto);
}

export async function createTerm(
  actor: Actor,
  businessUnitId: string,
  input: CreateTermData,
): Promise<TermDto> {
  assertDocumentTypes(input.domain, input.documentTypes);
  const term = await db().$transaction(async (tx) => {
    await loadBusinessUnit(actor, businessUnitId, tx);
    const last = await tx.termsCondition.aggregate({
      where: { businessUnitId, domain: input.domain },
      _max: { sortOrder: true },
    });
    return tx.termsCondition.create({
      data: {
        businessUnitId,
        domain: input.domain,
        content: input.content,
        isDefault: input.isDefault,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
        applicability: {
          create: input.documentTypes.map((documentType) => ({ documentType })),
        },
      },
      include: termInclude,
    });
  });
  return toDto(term);
}

export async function updateTerm(
  actor: Actor,
  id: string,
  patch: UpdateTermInput,
): Promise<TermDto> {
  const term = await db().$transaction(async (tx) => {
    const existing = await loadTerm(actor, id, tx);
    if (patch.documentTypes) {
      assertDocumentTypes(existing.domain, patch.documentTypes);
      await tx.termApplicability.deleteMany({ where: { termId: id } });
      await tx.termApplicability.createMany({
        data: patch.documentTypes.map((documentType) => ({ termId: id, documentType })),
      });
    }
    return tx.termsCondition.update({
      where: { id },
      data: { content: patch.content, isDefault: patch.isDefault },
      include: termInclude,
    });
  });
  return toDto(term);
}

export async function deleteTerm(actor: Actor, id: string): Promise<void> {
  await db().$transaction(async (tx) => {
    const existing = await loadTerm(actor, id, tx);
    await tx.termsCondition.delete({ where: { id } }); // applicability rows cascade
    await renumber(tx, existing.businessUnitId, existing.domain);
  });
}

/** Applies a new display order. `orderedIds` must list every term of the domain exactly once. */
export async function reorderTerms(
  actor: Actor,
  businessUnitId: string,
  input: ReorderTermsInput,
): Promise<TermDto[]> {
  await db().$transaction(async (tx) => {
    await loadBusinessUnit(actor, businessUnitId, tx);
    const current = await tx.termsCondition.findMany({
      where: { businessUnitId, domain: input.domain },
      select: { id: true },
    });
    const currentIds = new Set(current.map((term) => term.id));
    if (
      currentIds.size !== input.orderedIds.length ||
      !input.orderedIds.every((termId) => currentIds.has(termId))
    ) {
      throw badRequest("The term list has changed. Reload the page and try again.");
    }
    for (const [index, termId] of input.orderedIds.entries()) {
      await tx.termsCondition.update({ where: { id: termId }, data: { sortOrder: index + 1 } });
    }
  });
  return listTerms(actor, businessUnitId, input.domain);
}
