import { AppError, conflict } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { CompanyInput } from "../schemas/company.schema";
import type { CompanyDto } from "../types";
import { findActorCompany, sameName } from "./access";

// Serialises first-time company creation so concurrent saves cannot create two companies.
const COMPANY_CREATE_LOCK = 724_001;

function toDto(company: {
  id: string;
  name: string;
  address: string;
  email: string;
  updatedAt: Date;
}): CompanyDto {
  return {
    id: company.id,
    name: company.name,
    address: company.address,
    email: company.email,
    updatedAt: company.updatedAt.toISOString(),
  };
}

export async function getCompany(actor: Actor): Promise<CompanyDto | null> {
  const company = await findActorCompany(actor);
  return company ? toDto(company) : null;
}

/** Creates the company profile if none exists, otherwise updates it. */
export async function saveCompany(actor: Actor, input: CompanyInput): Promise<CompanyDto> {
  const company = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COMPANY_CREATE_LOCK})`;

    const existing = await findActorCompany(actor, tx);
    const duplicate = await tx.company.findFirst({
      where: { name: sameName(input.name), NOT: existing ? { id: existing.id } : undefined },
      select: { id: true },
    });
    if (duplicate) throw conflict("A company with this name already exists.");

    if (existing) {
      assertCompanyAccess(actor, existing.id, "Company");
      return tx.company.update({ where: { id: existing.id }, data: input });
    }
    if (actor.companyScope !== "ALL") {
      throw new AppError(403, "FORBIDDEN", "You are not allowed to create a company.");
    }
    return tx.company.create({ data: input });
  });
  return toDto(company);
}
