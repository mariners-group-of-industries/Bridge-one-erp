import { notFound } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/prisma/client";
import type { SalaryDto, UpsertSalaryInput } from "../schemas/salary.schema";

// ─── helpers ─────────────────────────────────────────────────────────────────

const d = (v: unknown): string => (v != null ? String(v) : "");
const dec = (v: string | undefined) => (v && v !== "" ? parseFloat(v) : null);

async function assertEmployee(id: string, actor: Actor) {
  const emp = await db().employee.findUnique({
    where: { id },
    include: { office: { include: { businessUnit: true } } },
  });
  if (!emp || !emp.office?.businessUnit) throw notFound("Employee");
  if (
    !actor.isMaster &&
    actor.companyScope !== "ALL" &&
    !actor.companyScope.includes(emp.office.businessUnit.companyId)
  ) throw notFound("Employee");
  return emp;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function getSalary(employeeId: string, actor: Actor): Promise<SalaryDto> {
  await assertEmployee(employeeId, actor);

  const [salary, adjustments] = await Promise.all([
    db().employeeSalary.findUnique({ where: { employeeId } }),
    db().employeeSalaryAdjustment.findMany({
      where: { employeeId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    salaryType:      salary?.salaryType      ?? "regular",
    salaryOption:    salary?.salaryOption    ?? "gross",
    grossOnly:       d(salary?.grossOnly),
    structBasic:     d(salary?.structBasic),
    structGross:     d(salary?.structGross),
    sgGross:         d(salary?.sgGross),
    sgBasic:         d(salary?.sgBasic),
    sgHouseRent:     d(salary?.sgHouseRent),
    sgMedical:       d(salary?.sgMedical),
    sgConveyance:    d(salary?.sgConveyance),
    sgMobile:        d(salary?.sgMobile),
    sgFood:          d(salary?.sgFood),
    sgExtra:         d(salary?.sgExtra),
    disbursementMode: salary?.disbursementMode ?? "cash",
    eligibleOT:      salary?.eligibleOT      ?? false,
    eligiblePF:      salary?.eligiblePF      ?? false,
    bankName:        salary?.bankName        ?? "",
    branchName:      salary?.branchName      ?? "",
    bankAccountName: salary?.bankAccountName ?? "",
    bankAccountNo:   salary?.bankAccountNo   ?? "",
    routingNo:       salary?.routingNo       ?? "",
    mfsProvider:     salary?.mfsProvider     ?? "",
    mfsNumber:       salary?.mfsNumber       ?? "",
    mfsAccountName:  salary?.mfsAccountName  ?? "",
    adjustments: adjustments.map((a) => ({
      id:        a.id,
      fromMonth: a.fromMonth,
      toMonth:   a.toMonth,
      type:      a.type as "addition" | "deduction",
      amount:    d(a.amount),
    })),
  };
}

// ─── UPSERT ───────────────────────────────────────────────────────────────────

export async function upsertSalary(
  employeeId: string,
  actor: Actor,
  input: UpsertSalaryInput,
): Promise<SalaryDto> {
  await assertEmployee(employeeId, actor);

  const data = {
    salaryType:      input.salaryType,
    salaryOption:    input.salaryOption,
    grossOnly:       dec(input.grossOnly),
    structBasic:     dec(input.structBasic),
    structGross:     dec(input.structGross),
    sgGross:         dec(input.sgGross),
    sgBasic:         dec(input.sgBasic),
    sgHouseRent:     dec(input.sgHouseRent),
    sgMedical:       dec(input.sgMedical),
    sgConveyance:    dec(input.sgConveyance),
    sgMobile:        dec(input.sgMobile),
    sgFood:          dec(input.sgFood),
    sgExtra:         dec(input.sgExtra),
    disbursementMode: input.disbursementMode,
    eligibleOT:      input.eligibleOT,
    eligiblePF:      input.eligiblePF,
    bankName:        input.bankName        || null,
    branchName:      input.branchName      || null,
    bankAccountName: input.bankAccountName || null,
    bankAccountNo:   input.bankAccountNo   || null,
    routingNo:       input.routingNo       || null,
    mfsProvider:     input.mfsProvider     || null,
    mfsNumber:       input.mfsNumber       || null,
    mfsAccountName:  input.mfsAccountName  || null,
    updatedAt:       new Date(),
  };

  await db().$transaction([
    db().employeeSalary.upsert({
      where:  { employeeId },
      create: { employeeId, ...data },
      update: data,
    }),
    db().employeeSalaryAdjustment.deleteMany({ where: { employeeId } }),
    ...(input.adjustments.length > 0
      ? [db().employeeSalaryAdjustment.createMany({
          data: input.adjustments.map((a) => ({
            employeeId,
            fromMonth: a.fromMonth,
            toMonth:   a.toMonth,
            type:      a.type,
            amount:    parseFloat(a.amount),
          })),
        })]
      : []),
  ]);

  return getSalary(employeeId, actor);
}
