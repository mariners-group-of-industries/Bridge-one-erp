import { AppError, notFound } from "@/lib/api/errors";
import { assertCompanyAccess, type Actor } from "@/lib/auth/actor";
import { db, type Prisma } from "@/lib/prisma/client";

type Client = Prisma.TransactionClient | ReturnType<typeof db>;

// Loaders that resolve a resource together with its owning company and enforce
// that the actor may access that company. Every service goes through these.

export async function findActorCompany(actor: Actor, client: Client = db()) {
  return client.company.findFirst({
    where: actor.companyScope === "ALL" ? {} : { id: { in: [...actor.companyScope] } },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireActorCompany(actor: Actor, client: Client = db()) {
  const company = await findActorCompany(actor, client);
  if (!company) {
    throw new AppError(
      409,
      "PRECONDITION_REQUIRED",
      "Save the company profile before adding business units.",
    );
  }
  return company;
}

export async function loadBusinessUnit(actor: Actor, id: string, client: Client = db()) {
  const businessUnit = await client.businessUnit.findUnique({ where: { id } });
  if (!businessUnit) throw notFound("Business unit");
  assertCompanyAccess(actor, businessUnit.companyId, "Business unit");
  return businessUnit;
}

export async function loadOffice(actor: Actor, id: string, client: Client = db()) {
  const office = await client.office.findUnique({
    where: { id },
    include: { businessUnit: { select: { companyId: true } } },
  });
  if (!office) throw notFound("Office");
  assertCompanyAccess(actor, office.businessUnit.companyId, "Office");
  return office;
}

export async function loadWarehouse(actor: Actor, id: string, client: Client = db()) {
  const warehouse = await client.warehouse.findUnique({
    where: { id },
    include: { office: { select: { businessUnit: { select: { companyId: true } } } } },
  });
  if (!warehouse) throw notFound("Warehouse");
  assertCompanyAccess(actor, warehouse.office.businessUnit.companyId, "Warehouse");
  return warehouse;
}

export async function loadTerm(actor: Actor, id: string, client: Client = db()) {
  const term = await client.termsCondition.findUnique({
    where: { id },
    include: { businessUnit: { select: { companyId: true } } },
  });
  if (!term) throw notFound("Terms & conditions entry");
  assertCompanyAccess(actor, term.businessUnit.companyId, "Terms & conditions entry");
  return term;
}

/** Case-insensitive name filter used for duplicate-name checks. */
export function sameName(name: string) {
  return { equals: name, mode: "insensitive" as const };
}
