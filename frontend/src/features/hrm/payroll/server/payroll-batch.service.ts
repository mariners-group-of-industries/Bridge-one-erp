import { Prisma } from "@/generated/prisma/client";
import { AppError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { canOn, type Actor } from "@/lib/auth/actor";
import { approvalTrail, recordApproval, recordRejection, resetApproval } from "@/lib/approval/engine";
import { db } from "@/lib/prisma/client";
import { notifyEmployees } from "@/lib/notifications/notify";
import { formatNumber, nextNumber } from "@/features/sales/lib/sequence";
import { decisionBy, isoDate, num, officeScope, requireHr, toDate } from "../../shared/hr-access";
import { hrmPaths } from "../../paths";
import {
  cancelSchema,
  decisionSchema,
  EDITABLE_STATUSES,
  generateInputSchema,
  LINE_SORTS,
  PAYROLL_APPROVAL_FEATURE,
  PAYROLL_STATUSES,
  PF_CODE,
  updateBatchSchema,
  versionSchema,
  type ApprovalProgress,
  type ExcludedEmployee,
  type GenerateInput,
  type LineSort,
  type PayrollBatchDetail,
  type PayrollBatchList,
  type PayrollBatchRow,
  type PayrollBatchStatus,
  type PayrollLine,
  type PayrollLineDetail,
  type PayrollLinePage,
  type PayrollPreview,
  type PayrollSequence,
  type PayrollTotals,
  type PolicyUse,
} from "../batch-types";
import { calculateEmployee, sumLines } from "./engine";
import { loadPayrollInputs, type LoadedPayroll } from "./payroll-inputs";

type Tx = Prisma.TransactionClient;
const PAGE = hrmPaths.payroll;
const FEATURE = PAYROLL_APPROVAL_FEATURE;
const periodKeyOf = (month: string, salaryType: string) => `${month}|${salaryType}`;
const json = (value: unknown) => value as Prisma.InputJsonValue;

const canApprove = (actor: Actor) => canOn(actor, PAGE, "approve", "employees:read");
const canEdit = (actor: Actor) => canOn(actor, PAGE, "edit", "employees:read") || canOn(actor, PAGE, "create", "employees:read");

const batchScope = (actor: Actor): Prisma.PayrollBatchWhereInput => (actor.companyScope === "ALL" ? {} : { office: officeScope(actor) });

// ─── Calculation ──────────────────────────────────────────────────────────────

interface Calculated {
  loaded: LoadedPayroll;
  lines: PayrollLineDetail[];
  totals: PayrollTotals;
  warningCount: number;
  errorCount: number;
}

async function calculateOffice(actor: Actor, officeId: string, month: string): Promise<Calculated> {
  const office = await db().office.findFirst({ where: { id: officeId, ...officeScope(actor) }, select: { id: true } });
  if (!office) throw notFound("Office");
  const loaded = await loadPayrollInputs(officeId, month);
  if (!loaded) throw notFound("Office");
  const lines: PayrollLineDetail[] = loaded.employees.map((e, index) => {
    const r = calculateEmployee(e, loaded.period, loaded.policies);
    return {
      id: null,
      employeeId: e.id,
      sl: index + 1,
      employeeCode: e.code,
      employeeName: e.name,
      joiningDate: e.joiningDate,
      designation: e.designation,
      department: e.department,
      grossSalary: r.grossSalary,
      basic: r.basic,
      houseRent: r.houseRent,
      medical: r.medical,
      transport: r.transport,
      components: r.components,
      earnedGross: r.earnedGross,
      additions: r.additions,
      attendanceDeduction: r.attendanceDeduction,
      otherDeduction: r.otherDeduction,
      totalDeduction: r.totalDeduction,
      netPayable: r.netPayable,
      payMethod: r.payMethod,
      bankOrProvider: e.bankOrProvider,
      accountNo: e.accountNo,
      warnings: r.warnings,
      errors: r.errors,
      attendance: r.attendance,
      trace: r.trace,
    };
  });
  return {
    loaded,
    lines,
    totals: totalsOf(lines),
    warningCount: lines.reduce((t, l) => t + l.warnings.length, 0),
    errorCount: lines.reduce((t, l) => t + l.errors.length, 0),
  };
}

function totalsOf(lines: PayrollLineDetail[]): PayrollTotals {
  return {
    employees: lines.length,
    gross: sumLines(lines, (l) => l.grossSalary),
    basic: sumLines(lines, (l) => l.basic),
    // Allowance columns (MA, FA …); PFD is a deduction.
    allowances: sumLines(
      lines.flatMap((l) => Object.entries(l.components).filter(([code]) => code !== PF_CODE)),
      ([, value]) => value,
    ),
    earned: sumLines(lines, (l) => l.earnedGross),
    additions: sumLines(lines, (l) => l.additions),
    attendanceDeduction: sumLines(lines, (l) => l.attendanceDeduction),
    otherDeduction: sumLines(lines, (l) => l.otherDeduction),
    net: sumLines(lines, (l) => l.netPayable),
  };
}

const lineData = (l: PayrollLineDetail, hash: string, periodKey: string) => ({
  employeeId: l.employeeId,
  periodKey,
  sl: l.sl,
  employeeCode: l.employeeCode,
  employeeName: l.employeeName,
  joiningDate: toDate(l.joiningDate),
  designation: l.designation,
  department: l.department,
  grossSalary: l.grossSalary,
  basic: l.basic,
  houseRent: l.houseRent,
  medical: l.medical,
  transport: l.transport,
  components: json(l.components),
  earnedGross: l.earnedGross,
  additions: l.additions,
  attendanceDeduction: l.attendanceDeduction,
  otherDeduction: l.otherDeduction,
  totalDeduction: l.totalDeduction,
  netPayable: l.netPayable,
  payMethod: l.payMethod,
  bankOrProvider: l.bankOrProvider,
  accountNo: l.accountNo,
  attendance: json(l.attendance),
  trace: json(l.trace),
  warnings: json(l.warnings),
  errors: json(l.errors),
  sourceHash: hash,
});

const batchFigures = (c: Calculated) => ({
  eligibleCount: c.loaded.eligibleCount,
  employeeCount: c.lines.length,
  totalGross: c.totals.gross,
  totalBasic: c.totals.basic,
  totalAllowances: c.totals.allowances,
  totalEarned: c.totals.earned,
  totalAdditions: c.totals.additions,
  totalAttendanceDeduction: c.totals.attendanceDeduction,
  totalOtherDeduction: c.totals.otherDeduction,
  totalNet: c.totals.net,
  warningCount: c.warningCount,
  errorCount: c.errorCount,
  excluded: json(c.loaded.excluded),
  policySnapshot: json(c.loaded.policyUses),
  sourceHash: c.loaded.sourceHash,
  calculatedAt: new Date(),
});

async function liveBatchFor(officeId: string, periodKey: string) {
  return db().payrollBatch.findFirst({ where: { officeId, periodKey }, select: { id: true, reference: true, status: true } });
}

/** Unique-key clashes become a readable conflict (another user generated the same payroll first). */
async function explainDuplicate(error: unknown, officeId: string, periodKey: string): Promise<never> {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String((error.meta as { target?: unknown } | undefined)?.target ?? "");
    const live = await liveBatchFor(officeId, periodKey);
    if (live) throw conflict(`Payroll ${live.reference} (${live.status}) already exists for this office and period.`);
    if (target.includes("employee")) throw conflict("Some employees already have a salary for this period in another office's payroll. Cancel that payroll first.");
    throw conflict("A payroll for this office and period already exists.");
  }
  throw error;
}

/** Employees of this calculation already paid in another live batch of the same period (e.g. moved office). */
async function paidElsewhere(employeeIds: string[], periodKey: string, exceptBatchId?: string) {
  if (employeeIds.length === 0) return [];
  return db().payrollBatchLine.findMany({
    where: { employeeId: { in: employeeIds }, periodKey, ...(exceptBatchId ? { batchId: { not: exceptBatchId } } : {}) },
    select: { employeeCode: true, batch: { select: { reference: true } } },
  });
}

// ─── Month sequence ───────────────────────────────────────────────────────────

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** "2026-12" → "2027-01" */
export function nextMonthOf(month: string) {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}

/** The office's latest live payroll of the salary type, and the month that must follow it. */
async function sequenceOf(client: Tx | ReturnType<typeof db>, officeId: string, salaryType: string): Promise<PayrollSequence | null> {
  const last = await client.payrollBatch.findFirst({
    where: { officeId, salaryType, status: { not: "Cancelled" } },
    orderBy: { month: "desc" },
    select: { month: true, reference: true, status: true },
  });
  return last ? { lastMonth: last.month, lastReference: last.reference, lastStatus: last.status as PayrollBatchStatus, nextMonth: nextMonthOf(last.month) } : null;
}

/** A new payroll must be for the month right after the office's latest one: no earlier month, no gap. */
function assertInSequence(sequence: PayrollSequence | null, month: string) {
  if (!sequence || month === sequence.nextMonth) return;
  if (month === sequence.lastMonth) throw conflict(`Payroll ${sequence.lastReference} (${sequence.lastStatus}) already exists for this office and period.`);
  const last = `${monthName(sequence.lastMonth)} (${sequence.lastReference})`;
  if (month <= sequence.lastMonth) throw badRequest(`Salary is already generated up to ${last}. An earlier month cannot be generated; the next payroll is ${monthName(sequence.nextMonth)}.`);
  throw badRequest(`The last payroll is ${last}, so the next one must be ${monthName(sequence.nextMonth)}; ${monthName(month)} would skip a month.`);
}

/** For the Salary Generate form: which month the office's next payroll must be. */
export async function payrollSequence(actor: Actor, officeId: string, salaryType: string): Promise<PayrollSequence | null> {
  requireHr(actor);
  if (!(await db().office.findFirst({ where: { id: officeId, ...officeScope(actor) }, select: { id: true } }))) throw notFound("Office");
  return sequenceOf(db(), officeId, salaryType);
}

// ─── Preview / generate ───────────────────────────────────────────────────────

export async function previewPayroll(actor: Actor, input: GenerateInput): Promise<PayrollPreview> {
  requireHr(actor);
  const data = generateInputSchema.parse(input);
  const c = await calculateOffice(actor, data.officeId, data.month);
  const periodKey = periodKeyOf(data.month, data.salaryType);
  const existing = await liveBatchFor(data.officeId, periodKey);
  const elsewhere = await paidElsewhere(
    c.lines.map((l) => l.employeeId),
    periodKey,
    existing?.id,
  );
  const notices = [...c.loaded.notices];
  const sequence = await sequenceOf(db(), data.officeId, data.salaryType);
  if (elsewhere.length) notices.push(`${elsewhere.length} employee(s) already have a salary for this period in ${[...new Set(elsewhere.map((e) => e.batch.reference))].join(", ")}: ${elsewhere.map((e) => e.employeeCode).join(", ")}.`);
  return {
    officeId: c.loaded.office.id,
    officeName: c.loaded.office.name,
    businessUnit: c.loaded.office.businessUnit,
    month: data.month,
    fromDate: c.loaded.period.fromDate,
    toDate: c.loaded.period.toDate,
    salaryType: data.salaryType,
    eligibleCount: c.loaded.eligibleCount,
    lines: c.lines,
    excluded: c.loaded.excluded,
    totals: c.totals,
    warningCount: c.warningCount,
    errorCount: c.errorCount,
    notices,
    policies: c.loaded.policyUses,
    existing: existing ? { ...existing, status: existing.status as PayrollBatchStatus } : null,
    sequence,
    inSequence: !sequence || !!existing || data.month === sequence.nextMonth,
  };
}

/** Calculates and saves a Draft batch. The figures are always calculated on the server. */
export async function createPayrollBatch(actor: Actor, input: GenerateInput): Promise<{ id: string; reference: string }> {
  requireHr(actor);
  const data = generateInputSchema.parse(input);
  const c = await calculateOffice(actor, data.officeId, data.month);
  if (c.lines.length === 0) throw badRequest("No employee of this office has a salary for the month.");
  const periodKey = periodKeyOf(data.month, data.salaryType);
  const live = await liveBatchFor(data.officeId, periodKey);
  if (live) throw conflict(`Payroll ${live.reference} (${live.status}) already exists for this office and period.`);
  assertInSequence(await sequenceOf(db(), data.officeId, data.salaryType), data.month);
  const by = decisionBy(actor);
  try {
    return await db().$transaction(async (tx) => {
      // Checked again inside the transaction, against payrolls saved meanwhile.
      assertInSequence(await sequenceOf(tx, data.officeId, data.salaryType), data.month);
      const year = Number(data.month.slice(0, 4));
      const reference = formatNumber("PAY", year, await nextNumber(tx, c.loaded.office.businessUnitId, "PAYROLL_BATCH", year));
      const batch = await tx.payrollBatch.create({
        data: {
          reference,
          businessUnitId: c.loaded.office.businessUnitId,
          officeId: data.officeId,
          salaryType: data.salaryType,
          month: data.month,
          fromDate: toDate(c.loaded.period.fromDate),
          toDate: toDate(c.loaded.period.toDate),
          payrollDate: toDate(data.payrollDate),
          description: data.description || null,
          status: "Draft",
          periodKey,
          ...batchFigures(c),
          createdById: actor.id,
          createdByName: by,
          updatedByName: by,
          lines: { create: c.lines.map((l, i) => lineData(l, c.loaded.employees[i].hash, periodKey)) },
          events: { create: { action: "Generated", toStatus: "Draft", actorId: actor.id, actorName: by, remarks: `${c.lines.length} employees, net ${c.totals.net.toFixed(2)}.` } },
        },
        select: { id: true, reference: true },
      });
      return batch;
    });
  } catch (error) {
    return explainDuplicate(error, data.officeId, periodKey);
  }
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

async function findBatch(actor: Actor, id: string) {
  const batch = await db().payrollBatch.findFirst({ where: { id, ...batchScope(actor) }, include: { office: { select: { name: true } }, businessUnit: { select: { name: true } } } });
  if (!batch) throw notFound("Payroll");
  return batch;
}

const editable = (status: string) => (EDITABLE_STATUSES as readonly string[]).includes(status);

/** Changes the batch only if nobody else changed it first (version and status as read). */
async function guardedUpdate(tx: Tx, id: string, version: number, statuses: readonly string[], data: Prisma.PayrollBatchUpdateManyMutationInput) {
  const { count } = await tx.payrollBatch.updateMany({ where: { id, version, status: { in: [...statuses] } }, data: { ...data, version: { increment: 1 } } });
  if (count === 0) throw conflict("This payroll was changed by someone else. Reload it and try again.");
}

function requireEditor(actor: Actor) {
  if (!canEdit(actor)) throw new AppError(403, "FORBIDDEN", "You do not have permission to change payrolls.");
}

export async function updatePayrollBatch(actor: Actor, id: string, input: unknown) {
  requireHr(actor);
  requireEditor(actor);
  const data = updateBatchSchema.parse(input);
  const batch = await findBatch(actor, id);
  if (!editable(batch.status)) throw conflict(`A payroll that is ${batch.status} cannot be edited.`);
  const by = decisionBy(actor);
  await db().$transaction(async (tx) => {
    await guardedUpdate(tx, id, data.version, EDITABLE_STATUSES, { payrollDate: toDate(data.payrollDate), description: data.description || null, updatedByName: by });
    await tx.payrollBatchEvent.create({ data: { batchId: id, action: "Updated", fromStatus: batch.status, toStatus: batch.status, actorId: actor.id, actorName: by, remarks: "Payroll date / description changed." } });
  });
}

/** Recalculates an editable batch from the current salary, attendance and policy data. */
export async function recalculatePayrollBatch(actor: Actor, id: string, input: unknown) {
  requireHr(actor);
  requireEditor(actor);
  const { version } = versionSchema.parse(input);
  const batch = await findBatch(actor, id);
  if (!editable(batch.status)) throw conflict(`A payroll that is ${batch.status} is locked; it cannot be recalculated.`);
  const c = await calculateOffice(actor, batch.officeId, batch.month);
  if (c.lines.length === 0) throw badRequest("No employee of this office has a salary for the month any more.");
  const periodKey = batch.periodKey ?? periodKeyOf(batch.month, batch.salaryType);
  const by = decisionBy(actor);
  const before = num(batch.totalNet);
  try {
    await db().$transaction(async (tx) => {
      await guardedUpdate(tx, id, version, EDITABLE_STATUSES, { ...batchFigures(c), updatedByName: by });
      await tx.payrollBatchLine.deleteMany({ where: { batchId: id } });
      await tx.payrollBatchLine.createMany({ data: c.lines.map((l, i) => ({ ...lineData(l, c.loaded.employees[i].hash, periodKey), batchId: id })) });
      await tx.payrollBatchEvent.create({
        data: { batchId: id, action: "Recalculated", fromStatus: batch.status, toStatus: batch.status, actorId: actor.id, actorName: by, remarks: `Net ${before.toFixed(2)} → ${c.totals.net.toFixed(2)}; ${c.lines.length} employees.` },
      });
    });
  } catch (error) {
    await explainDuplicate(error, batch.officeId, periodKey);
  }
}

/** Freezes the batch and sends it to the Salary Sheet approval pipeline. */
export async function submitPayrollBatch(actor: Actor, id: string, input: unknown) {
  requireHr(actor);
  requireEditor(actor);
  const { version } = versionSchema.parse(input);
  const batch = await findBatch(actor, id);
  if (!editable(batch.status)) throw conflict(`A payroll that is ${batch.status} cannot be submitted.`);
  if (batch.errorCount > 0) throw badRequest(`Fix the ${batch.errorCount} error(s) in this payroll and recalculate before submitting.`);
  if (batch.employeeCount === 0) throw badRequest("This payroll has no employees.");
  const current = await loadPayrollInputs(batch.officeId, batch.month);
  if (!current || current.sourceHash !== batch.sourceHash) throw conflict("Salary, attendance or policy data changed since this payroll was calculated. Recalculate it, check the figures, then submit.");
  const by = decisionBy(actor);
  await db().$transaction(async (tx) => {
    await guardedUpdate(tx, id, version, EDITABLE_STATUSES, { status: "Under Processing", submittedAt: new Date(), submittedByName: by, rejectionReason: null, decidedAt: null, decidedByName: null, updatedByName: by });
    // A resubmission starts a new approval round from the current pipeline.
    await resetApproval(tx, FEATURE, id);
    await tx.payrollBatchEvent.create({ data: { batchId: id, action: batch.status === "Rejected" ? "Resubmitted" : "Submitted", fromStatus: batch.status, toStatus: "Under Processing", actorId: actor.id, actorName: by } });
  });
}

/** Approves the current stage (Approved only after the last stage) or rejects the batch. */
export async function decidePayrollBatch(actor: Actor, id: string, input: unknown) {
  requireHr(actor);
  if (!canApprove(actor)) throw new AppError(403, "FORBIDDEN", "You do not have permission to approve payrolls.");
  const data = decisionSchema.parse(input);
  const batch = await findBatch(actor, id);
  if (batch.status !== "Under Processing") throw conflict(`This payroll is ${batch.status}; only payrolls under processing can be approved or rejected.`);
  const by = decisionBy(actor);
  const target = { feature: FEATURE, documentId: id, businessUnitId: batch.businessUnitId, amount: num(batch.totalNet), comment: data.remarks || null };
  return db().$transaction(async (tx) => {
    if (data.decision === "reject") {
      const stage = await tx.documentApproval.findFirst({ where: { feature: FEATURE, documentId: id, status: "PENDING" }, orderBy: { stageNo: "asc" }, select: { stageNo: true, stageName: true } });
      await recordRejection(tx, actor, target);
      await guardedUpdate(tx, id, data.version, ["Under Processing"], { status: "Rejected", rejectionReason: data.remarks, decidedAt: new Date(), decidedByName: by, updatedByName: by });
      await tx.payrollBatchEvent.create({
        data: { batchId: id, action: "Rejected", fromStatus: "Under Processing", toStatus: "Rejected", stageNo: stage?.stageNo ?? null, stageName: stage?.stageName ?? null, actorId: actor.id, actorName: by, remarks: data.remarks },
      });
      return { status: "Rejected" as PayrollBatchStatus, final: true };
    }
    const result = await recordApproval(tx, actor, target);
    const status: PayrollBatchStatus = result.final ? "Approved" : "Under Processing";
    await guardedUpdate(tx, id, data.version, ["Under Processing"], result.final ? { status, decidedAt: new Date(), decidedByName: by, updatedByName: by } : { updatedByName: by });
    const stageText = result.stage ? `Stage ${result.stage.stageNo} of ${result.stages} (${result.stage.name})` : "Single-level approval";
    await tx.payrollBatchEvent.create({
      data: {
        batchId: id,
        action: result.final ? "Approved" : result.stage?.done ? "Stage approved" : "Approval recorded",
        fromStatus: "Under Processing",
        toStatus: status,
        stageNo: result.stage?.stageNo ?? null,
        stageName: result.stage?.name ?? null,
        actorId: actor.id,
        actorName: by,
        remarks: [data.remarks, result.final ? `${stageText}: final approval.` : result.next ? `${stageText}; waiting for stage ${result.next.stageNo} (${result.next.name}).` : stageText].filter(Boolean).join(" "),
      },
    });
    return { status, final: result.final };
  });
}

/**
 * Publishes an Approved batch's payslips: from now on each employee sees their
 * own line in Employee Self Service › My Payslips, and is notified. Approval and
 * publication are separate steps, so HR can approve first and release later.
 */
export async function publishPayslips(actor: Actor, id: string) {
  requireHr(actor);
  if (!canApprove(actor)) throw new AppError(403, "FORBIDDEN", "You need the Approve permission on Payroll to publish payslips.");
  const batch = await findBatch(actor, id);
  if (batch.status !== "Approved") throw conflict(`This payroll is ${batch.status}; only an approved payroll's payslips can be published.`);
  if (batch.payslipsPublishedAt) throw conflict("These payslips are already published.");
  const by = decisionBy(actor);
  await db().$transaction(async (tx) => {
    const { count } = await tx.payrollBatch.updateMany({ where: { id, status: "Approved", payslipsPublishedAt: null }, data: { payslipsPublishedAt: new Date(), payslipsPublishedByName: by } });
    if (!count) throw conflict("These payslips are already published.");
    await tx.payrollBatchEvent.create({ data: { batchId: id, action: "Payslips published", fromStatus: "Approved", toStatus: "Approved", actorId: actor.id, actorName: by } });
  });
  const lines = await db().payrollBatchLine.findMany({ where: { batchId: id }, select: { employeeId: true } });
  await notifyEmployees(
    lines.map((l) => l.employeeId),
    { kind: "payslip", title: `Payslip for ${batch.month} is available`, body: `Your ${batch.salaryType.toLowerCase()} salary for ${batch.month} has been approved and published.`, link: "/employee/payslips" },
  );
  return { publishedAt: new Date().toISOString() };
}

/** Cancels a Draft or Rejected batch; it stays for audit and frees the period for a new payroll. */
export async function cancelPayrollBatch(actor: Actor, id: string, input: unknown) {
  requireHr(actor);
  requireEditor(actor);
  const data = cancelSchema.parse(input);
  const batch = await findBatch(actor, id);
  if (!editable(batch.status)) throw conflict(`A payroll that is ${batch.status} cannot be cancelled.`);
  const by = decisionBy(actor);
  await db().$transaction(async (tx) => {
    await guardedUpdate(tx, id, data.version, EDITABLE_STATUSES, { status: "Cancelled", periodKey: null, cancelReason: data.reason, updatedByName: by });
    await tx.payrollBatchLine.updateMany({ where: { batchId: id }, data: { periodKey: null } });
    await tx.payrollBatchEvent.create({ data: { batchId: id, action: "Cancelled", fromStatus: batch.status, toStatus: "Cancelled", actorId: actor.id, actorName: by, remarks: data.reason } });
  });
}

// ─── Reads ────────────────────────────────────────────────────────────────────

async function progressOf(ids: string[]): Promise<Map<string, ApprovalProgress>> {
  const stages = ids.length ? await db().documentApproval.findMany({ where: { feature: FEATURE, documentId: { in: ids } }, orderBy: { stageNo: "asc" }, select: { documentId: true, stageNo: true, stageName: true, status: true } }) : [];
  const out = new Map<string, ApprovalProgress>();
  for (const id of ids) {
    const own = stages.filter((s) => s.documentId === id);
    const pending = own.find((s) => s.status === "PENDING");
    out.set(id, { stages: own.length, current: pending ? { stageNo: pending.stageNo, name: pending.stageName } : null });
  }
  return out;
}

export interface BatchFilter {
  officeId?: string;
  month?: string;
  year?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listPayrollBatches(actor: Actor, filter: BatchFilter): Promise<PayrollBatchList> {
  requireHr(actor);
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 20));
  const search = filter.search?.trim();
  const status = PAYROLL_STATUSES.find((s) => s === filter.status);
  const month = filter.year && filter.month ? `${filter.year}-${filter.month}` : null;
  const where: Prisma.PayrollBatchWhereInput = {
    ...batchScope(actor),
    ...(filter.officeId ? { officeId: filter.officeId } : {}),
    ...(month ? { month } : filter.year ? { month: { startsWith: `${filter.year}-` } } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { lines: { some: { OR: [{ employeeCode: { contains: search, mode: "insensitive" } }, { employeeName: { contains: search, mode: "insensitive" } }] } } },
          ],
        }
      : {}),
  };
  const [total, batches] = await Promise.all([
    db().payrollBatch.count({ where }),
    db().payrollBatch.findMany({
      where,
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { office: { select: { name: true } }, businessUnit: { select: { name: true } } },
    }),
  ]);
  const progress = await progressOf(batches.map((b) => b.id));
  const rows: PayrollBatchRow[] = batches.map((b) => ({
    id: b.id,
    reference: b.reference,
    businessUnit: b.businessUnit.name,
    officeId: b.officeId,
    officeName: b.office.name,
    month: b.month,
    salaryType: b.salaryType,
    payrollDate: isoDate(b.payrollDate),
    employeeCount: b.employeeCount,
    totalGross: num(b.totalGross),
    totalDeduction: num(b.totalAttendanceDeduction.add(b.totalOtherDeduction)),
    totalNet: num(b.totalNet),
    status: b.status as PayrollBatchStatus,
    approval: progress.get(b.id)!,
    warningCount: b.warningCount,
    errorCount: b.errorCount,
    createdByName: b.createdByName,
    createdAt: b.createdAt.toISOString(),
  }));
  return { rows, total, page, pageSize };
}

export async function getPayrollBatch(actor: Actor, id: string): Promise<PayrollBatchDetail> {
  requireHr(actor);
  const b = await findBatch(actor, id);
  const [events, stages, progress] = await Promise.all([
    db().payrollBatchEvent.findMany({ where: { batchId: id }, orderBy: { createdAt: "asc" } }),
    approvalTrail(FEATURE, id),
    progressOf([id]),
  ]);
  let stale = false;
  if (editable(b.status)) stale = (await loadPayrollInputs(b.officeId, b.month))?.sourceHash !== b.sourceHash;
  const isEditor = canEdit(actor);
  return {
    id: b.id,
    reference: b.reference,
    businessUnit: b.businessUnit.name,
    officeId: b.officeId,
    officeName: b.office.name,
    month: b.month,
    fromDate: isoDate(b.fromDate),
    toDate: isoDate(b.toDate),
    salaryType: b.salaryType,
    payrollDate: isoDate(b.payrollDate),
    description: b.description,
    status: b.status as PayrollBatchStatus,
    version: b.version,
    eligibleCount: b.eligibleCount,
    totals: {
      employees: b.employeeCount,
      gross: num(b.totalGross),
      basic: num(b.totalBasic),
      allowances: num(b.totalAllowances),
      earned: num(b.totalEarned),
      additions: num(b.totalAdditions),
      attendanceDeduction: num(b.totalAttendanceDeduction),
      otherDeduction: num(b.totalOtherDeduction),
      net: num(b.totalNet),
    },
    warningCount: b.warningCount,
    errorCount: b.errorCount,
    excluded: b.excluded as unknown as ExcludedEmployee[],
    policies: b.policySnapshot as unknown as PolicyUse[],
    calculatedAt: b.calculatedAt.toISOString(),
    createdByName: b.createdByName,
    createdAt: b.createdAt.toISOString(),
    submittedAt: b.submittedAt?.toISOString() ?? null,
    submittedByName: b.submittedByName,
    decidedAt: b.decidedAt?.toISOString() ?? null,
    decidedByName: b.decidedByName,
    rejectionReason: b.rejectionReason,
    cancelReason: b.cancelReason,
    payslipsPublishedAt: b.payslipsPublishedAt?.toISOString() ?? null,
    payslipsPublishedByName: b.payslipsPublishedByName,
    stale,
    approval: progress.get(id)!,
    stages: stages.map((s) => ({ stageNo: s.stageNo, name: s.name, status: s.status, approverNames: s.approverNames, approvedNames: s.approvedNames, actedBy: s.actedBy, actedAt: s.actedAt, comment: s.comment })),
    events: events.map((e) => ({ id: e.id, action: e.action, fromStatus: e.fromStatus, toStatus: e.toStatus, stageNo: e.stageNo, stageName: e.stageName, actorName: e.actorName, remarks: e.remarks, createdAt: e.createdAt.toISOString() })),
    can: {
      edit: isEditor && editable(b.status),
      submit: isEditor && editable(b.status) && b.errorCount === 0 && !stale,
      cancel: isEditor && editable(b.status),
      decide: canApprove(actor) && b.status === "Under Processing",
      publish: canApprove(actor) && b.status === "Approved" && !b.payslipsPublishedAt,
    },
  };
}

type LineRow = Prisma.PayrollBatchLineGetPayload<object>;

function toLine(l: LineRow): PayrollLine {
  const n = (v: Prisma.Decimal | null) => (v === null ? null : num(v));
  return {
    id: l.id,
    employeeId: l.employeeId,
    sl: l.sl,
    employeeCode: l.employeeCode,
    employeeName: l.employeeName,
    joiningDate: isoDate(l.joiningDate),
    designation: l.designation,
    department: l.department,
    grossSalary: num(l.grossSalary),
    basic: n(l.basic),
    houseRent: n(l.houseRent),
    medical: n(l.medical),
    transport: n(l.transport),
    components: l.components as PayrollLine["components"],
    earnedGross: num(l.earnedGross),
    additions: num(l.additions),
    attendanceDeduction: num(l.attendanceDeduction),
    otherDeduction: num(l.otherDeduction),
    totalDeduction: num(l.totalDeduction),
    netPayable: num(l.netPayable),
    payMethod: l.payMethod,
    bankOrProvider: l.bankOrProvider,
    accountNo: l.accountNo,
    warnings: l.warnings as string[],
    errors: l.errors as string[],
  };
}

const SORT_ORDER: Record<LineSort, (dir: Prisma.SortOrder) => Prisma.PayrollBatchLineOrderByWithRelationInput> = {
  sl: (dir) => ({ sl: dir }),
  code: (dir) => ({ employeeCode: dir }),
  name: (dir) => ({ employeeName: dir }),
  gross: (dir) => ({ grossSalary: dir }),
  net: (dir) => ({ netPayable: dir }),
  deduction: (dir) => ({ totalDeduction: dir }),
};

export async function listPayrollLines(actor: Actor, id: string, filter: { search?: string; sort?: string; dir?: string; page?: number; pageSize?: number; issues?: boolean }): Promise<PayrollLinePage> {
  requireHr(actor);
  await findBatch(actor, id);
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filter.pageSize ?? 50));
  const search = filter.search?.trim();
  const sort = LINE_SORTS.find((s) => s === filter.sort) ?? "sl";
  const where: Prisma.PayrollBatchLineWhereInput = {
    batchId: id,
    ...(search ? { OR: [{ employeeCode: { contains: search, mode: "insensitive" } }, { employeeName: { contains: search, mode: "insensitive" } }] } : {}),
    ...(filter.issues ? { OR: [{ NOT: { warnings: { equals: [] } } }, { NOT: { errors: { equals: [] } } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db().payrollBatchLine.count({ where }),
    db().payrollBatchLine.findMany({ where, orderBy: [SORT_ORDER[sort](filter.dir === "desc" ? "desc" : "asc"), { sl: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows: rows.map(toLine), total, page, pageSize };
}

export async function getPayrollLine(actor: Actor, id: string, lineId: string): Promise<PayrollLineDetail> {
  requireHr(actor);
  await findBatch(actor, id);
  const line = await db().payrollBatchLine.findFirst({ where: { id: lineId, batchId: id } });
  if (!line) throw notFound("Payroll line");
  return { ...toLine(line), attendance: line.attendance as unknown as PayrollLineDetail["attendance"], trace: line.trace as unknown as PayrollLineDetail["trace"] };
}
