import { db } from "@/lib/prisma/client";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { isPlaceInOrgScope, resolvePurchaseOrgScope } from "@/lib/purchase-store/governance";
import type { Actor } from "@/lib/auth/actor";

/**
 * Name → record lookups for the accounts bulk-upload templates. Offices are
 * limited to the user's business units and Org Access (same rule as the
 * accounting store); accounts, cost centers and employees are matched by code/name.
 */
export interface AccountLookups {
  offices: { id: string; name: string; businessUnitId: string }[];
  accounts: { id: string; code: string; name: string; isGroup: boolean }[];
  costCenters: { id: string; code: string; name: string }[];
  employees: { id: string; name: string; employeeCode: string }[];
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}

export async function loadAccountLookups(actor: Actor): Promise<AccountLookups> {
  const prisma = db();
  const [unitIds, orgScope] = await Promise.all([scopedBusinessUnitIds(actor), resolvePurchaseOrgScope(actor)]);
  const [officesRaw, accounts, costCenters, employees, customers, suppliers] = await Promise.all([
    prisma.office.findMany({ select: { id: true, name: true, businessUnitId: true }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ select: { id: true, code: true, name: true, isGroup: true }, orderBy: { code: "asc" } }),
    prisma.costCenter.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.employee.findMany({ select: { id: true, name: true, employeeCode: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.supplier.findMany({ select: { id: true, name: true }, where: { isActive: true }, orderBy: { name: "asc" } }).catch(() => []),
  ]);
  const offices = officesRaw.filter((o) => unitIds.includes(o.businessUnitId) && isPlaceInOrgScope(orgScope, { officeId: o.id, businessUnitId: o.businessUnitId }));
  return { offices, accounts, costCenters, employees, customers, suppliers };
}

export function officeByName(lookups: AccountLookups, raw: string): { id: string; name: string; businessUnitId: string } {
  const value = raw.trim();
  if (!value) throw new Error("Office is required.");
  const found = lookups.offices.find((o) => o.name.trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`Office "${value}" not found (or not in your access).`);
  return found;
}

export function accountByCode(lookups: AccountLookups, raw: string, label = "Account Code") {
  const value = raw.trim();
  if (!value) throw new Error(`${label} is required.`);
  const found =
    lookups.accounts.find((a) => !a.isGroup && a.code.trim().toLowerCase() === value.toLowerCase()) ??
    lookups.accounts.find((a) => a.code.trim().toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`${label} "${value}" not found.`);
  return found;
}

export function costCenterByName(lookups: AccountLookups, raw: string, { required = false } = {}) {
  const value = raw.trim();
  if (!value) {
    if (required) throw new Error("Cost Center is required.");
    return undefined;
  }
  const found = lookups.costCenters.find(
    (c) => c.name.trim().toLowerCase() === value.toLowerCase() || c.code.trim().toLowerCase() === value.toLowerCase(),
  );
  if (!found) throw new Error(`Cost Center "${value}" not found.`);
  return found;
}

export function employeeByName(lookups: AccountLookups, raw: string, { required = false } = {}) {
  const value = raw.trim();
  if (!value) {
    if (required) throw new Error("Employee Name is required.");
    return undefined;
  }
  const found = lookups.employees.find(
    (e) => e.name.trim().toLowerCase() === value.toLowerCase() || e.employeeCode.trim().toLowerCase() === value.toLowerCase(),
  );
  if (!found) throw new Error(`Employee "${value}" not found.`);
  return found;
}

export function partnerByName(lookups: AccountLookups, type: string, raw: string): { id: string; name: string; partnerType: "CUSTOMER" | "SUPPLIER" | "EMPLOYEE" } {
  const value = raw.trim();
  const t = type.trim().toUpperCase();
  if (!t) throw new Error(`Partner Type is required when a Partner Name is given.`);
  if (t === "CUSTOMER" || t === "SUPPLIER" || t === "EMPLOYEE") {
    if (!value) throw new Error("Partner Name is required.");
    const pool = t === "CUSTOMER" ? lookups.customers : t === "SUPPLIER" ? lookups.suppliers : lookups.employees;
    const found = pool.find((p) => p.name.trim().toLowerCase() === value.toLowerCase());
    if (!found) throw new Error(`${t === "CUSTOMER" ? "Customer" : t === "SUPPLIER" ? "Supplier" : "Employee"} "${value}" not found.`);
    return { id: found.id, name: found.name, partnerType: t };
  }
  throw new Error("Partner Type: use CUSTOMER, SUPPLIER or EMPLOYEE.");
}
