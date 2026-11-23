import type { Prisma } from "@/generated/prisma/client";
import type { InventoryDocType } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/auth/actor";
import { grantsAllow } from "@/lib/permissions/registry";
import { db } from "@/lib/prisma/client";
import { scopedBusinessUnitIds } from "@/features/sales/lib/scope";
import { featureAliases } from "@/lib/approval/engine";
import { notFound } from "@/lib/api/errors";
import type { ApprovalCategory, ApprovalStageLoad, ApprovalSummary, PendingDocument, PendingList } from "../types";

/**
 * Multilayer Approval summary. Each source is one document type that goes
 * through approval: its statuses are bucketed into pending / approved /
 * rejected, and its pipeline (Approval Setup feature) is looked up by name.
 * A category is shown only when the user may view the page it is approved on.
 */

interface StatusRow {
  status: string;
  count: number;
  oldest: Date | null;
}

interface OldestRow {
  id: string;
  reference: string;
  createdAt: Date;
  /** Optimistic-lock token the module's approve endpoint expects (updatedAt or a version number). */
  version?: string;
}

interface Source {
  id: string;
  module: string;
  label: string;
  href: string;
  /** Where the category links to, when it differs from `href` (e.g. a preselected list). */
  link?: string;
  /** Approval Setup feature name, when the document can have a pipeline. */
  pipelineFeature: string | null;
  pending: readonly string[];
  approved: readonly string[];
  rejected: readonly string[];
  counts: (units: string[]) => Promise<StatusRow[]>;
  /** Oldest pending documents first, at most `take`. */
  oldest: (units: string[], take: number) => Promise<OldestRow[]>;
}

const OLDEST_PER_SOURCE = 5;
const OLDEST_TOTAL = 10;
/** Documents listed when one category is opened on the Multilayer Approval page. */
const LIST_LIMIT = 200;

const norm = (status: string) => status.trim().toUpperCase().replace(/[\s-]+/g, "_");

/** Spellings a free-text status column may hold ("PENDING", "Pending", "Pending Approval" …). */
function spellings(statuses: readonly string[]): string[] {
  const out = new Set<string>();
  for (const s of statuses) {
    const words = s.toLowerCase().split("_");
    const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    out.add(s);
    out.add(s.toLowerCase());
    out.add(title.join(" "));
    out.add(title.join("_"));
    out.add(title[0] + (words.length > 1 ? ` ${words.slice(1).join(" ")}` : ""));
  }
  return [...out];
}

type Grouped = { status: string; _count: { _all: number }; _min: { createdAt: Date | null } };
// Untyped parameter: a typed one leaks into Prisma's groupBy inference and breaks it.
const rows = (grouped: unknown): StatusRow[] => (grouped as Grouped[]).map((g) => ({ status: String(g.status), count: g._count._all, oldest: g._min.createdAt }));
const groupArgs = { by: "status" as const, _count: { _all: true as const }, _min: { createdAt: true as const } };
const pick = (take: number) => ({ orderBy: { createdAt: "asc" as const }, take });

const inUnits = (units: string[]) => ({ businessUnitId: { in: units } });
const employeeInUnits = (units: string[]) => ({ employee: { office: { businessUnitId: { in: units } } } });
const employeeRef = (e: { employeeCode: string; name: string }) => `${e.employeeCode} — ${e.name}`;
const employeeSelect = { select: { employeeCode: true, name: true } } as const;

const INVENTORY_PENDING = ["PENDING"] as const;
function inventorySource(id: string, label: string, href: string, type: InventoryDocType, pipelineFeature: string | null): Source {
  const where = (units: string[]): Prisma.InventoryDocumentWhereInput => ({ ...inUnits(units), type });
  return {
    id,
    module: "Inventory",
    label,
    href,
    pipelineFeature,
    pending: INVENTORY_PENDING,
    approved: ["APPROVED", "IN_TRANSIT", "COMPLETED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().inventoryDocument.groupBy({ ...groupArgs, where: where(units) })),
    oldest: async (units, take) =>
      (await db().inventoryDocument.findMany({ ...pick(take), where: { ...where(units), status: { in: [...INVENTORY_PENDING] } }, select: { id: true, number: true, createdAt: true } })).map((r) => ({
        id: r.id,
        reference: r.number,
        createdAt: r.createdAt,
      })),
  };
}

const RTM_PENDING = ["PENDING"] as const;

const SOURCES: readonly Source[] = [
  // ── Purchase ──
  {
    id: "purchase-requisition",
    module: "Purchase",
    label: "Purchase Requisition",
    href: "/purchase/requisitions",
    pipelineFeature: "Purchase Requisition",
    pending: ["PENDING"],
    approved: ["APPROVED", "ORDERED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().purchaseRequisition.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().purchaseRequisition.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING" }, select: { id: true, number: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt })),
  },
  {
    id: "purchase-order",
    module: "Purchase",
    label: "Purchase Order",
    href: "/purchase/orders",
    pipelineFeature: "Purchase Order",
    pending: ["PENDING"],
    approved: ["APPROVED", "PARTIAL_RECEIVED", "RECEIVED", "CLOSED"],
    rejected: [],
    counts: async (units) => rows(await db().purchaseOrder.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().purchaseOrder.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING" }, select: { id: true, number: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt })),
  },
  {
    id: "purchase-return",
    module: "Purchase",
    label: "Purchase Return",
    href: "/purchase/returns",
    pipelineFeature: "Purchase Return",
    pending: ["SUBMITTED", "PENDING"],
    approved: ["COMPLETED"],
    rejected: ["CANCELLED"],
    counts: async (units) => rows(await db().purchaseReturn.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().purchaseReturn.findMany({ ...pick(take), where: { ...inUnits(units), status: "SUBMITTED" }, select: { id: true, number: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt })),
  },
  {
    id: "supplier-bill",
    module: "Purchase",
    label: "Supplier Bill",
    href: "/purchase/supplier-payments",
    pipelineFeature: "Payment Approval",
    pending: ["PENDING"],
    approved: ["APPROVED"],
    rejected: [],
    counts: async (units) => rows(await db().supplierBill.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().supplierBill.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING" }, select: { id: true, number: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt })),
  },
  // ── Sales ──
  {
    id: "sales-order",
    module: "Sales",
    label: "Sales Order",
    href: "/sales/orders",
    pipelineFeature: "Sales Order",
    pending: ["PENDING_APPROVAL"],
    approved: ["APPROVED", "COMPLETED"],
    rejected: [],
    counts: async (units) => rows(await db().salesOrder.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().salesOrder.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING_APPROVAL" }, select: { id: true, number: true, createdAt: true, updatedAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt, version: r.updatedAt.toISOString() })),
  },
  {
    // A draft return is waiting for approval; submitting it approves it.
    id: "sales-return",
    module: "Sales",
    label: "Sales Return",
    href: "/sales/returns",
    pipelineFeature: "Sales Return",
    pending: ["DRAFT"],
    approved: ["SUBMITTED"],
    rejected: [],
    counts: async (units) => rows(await db().salesReturn.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().salesReturn.findMany({ ...pick(take), where: { ...inUnits(units), status: "DRAFT" }, select: { id: true, number: true, createdAt: true, updatedAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt, version: r.updatedAt.toISOString() })),
  },
  // ── Inventory ──
  inventorySource("stock-adjustment", "Stock Adjustment", "/inventory/stock-adjustment", "STOCK_UPDATE", "Stock Adjustment"),
  inventorySource("transfer-request", "Transfer Request", "/inventory/transfer-request", "TRANSFER_REQUEST", "Transfer Request"),
  inventorySource("store-requisition", "Store Requisition", "/inventory/store-requisition", "STORE_REQUISITION", "Store Requisition"),
  inventorySource("item-conversion", "Item Stock Conversion", "/inventory/item-stock-conversion", "CONVERSION", "Inventory Item Conversion"),
  // ── Production ──
  {
    id: "production-order",
    module: "Production",
    label: "Production Order",
    href: "/production/orders",
    pipelineFeature: "Production Order",
    pending: ["PENDING_APPROVAL"],
    approved: ["APPROVED", "IN_PROGRESS", "CLOSED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().productionOrder.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().productionOrder.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING_APPROVAL" }, select: { id: true, number: true, createdAt: true, updatedAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt, version: r.updatedAt.toISOString() })),
  },
  // ── Accounts (company-wide records) ──
  {
    id: "journal-voucher",
    module: "Accounts",
    label: "Journal Voucher",
    href: "/accounts/journal",
    // Posting a voucher runs the "Journal Voucher" pipeline (app/api/accounts/journal/[id]).
    pipelineFeature: "Journal Voucher",
    pending: ["PENDING"],
    approved: ["APPROVED", "POSTED"],
    rejected: ["REJECTED"],
    counts: async () => rows(await db().journalVoucher.groupBy({ ...groupArgs })),
    oldest: async (_units, take) =>
      (await db().journalVoucher.findMany({ ...pick(take), where: { status: { in: spellings(["PENDING"]) } }, select: { id: true, voucherNumber: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.voucherNumber, createdAt: r.createdAt })),
  },
  {
    id: "expense",
    module: "Accounts",
    label: "Expense",
    href: "/accounts/expenses",
    pipelineFeature: "Expense",
    pending: ["PENDING"],
    approved: ["APPROVED", "PAID"],
    rejected: ["REJECTED"],
    counts: async () => rows(await db().expenseRecord.groupBy({ ...groupArgs })),
    oldest: async (_units, take) =>
      (await db().expenseRecord.findMany({ ...pick(take), where: { status: { in: spellings(["PENDING"]) } }, select: { id: true, expenseNumber: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.expenseNumber, createdAt: r.createdAt })),
  },
  {
    id: "fund-transfer",
    module: "Accounts",
    label: "Fund Transfer",
    href: "/accounts/fund-transfers",
    // Approving runs the "Fund Transfer" pipeline (app/api/accounts/fund-transfers/[id]).
    pipelineFeature: "Fund Transfer",
    pending: ["SUBMITTED", "PENDING_APPROVAL", "PENDING"],
    approved: ["APPROVED", "COMPLETED", "DISPATCHED", "IN_TRANSIT", "RECEIVED"],
    rejected: ["REJECTED"],
    counts: async () => rows(await db().fundTransfer.groupBy({ ...groupArgs })),
    oldest: async (_units, take) =>
      (
        await db().fundTransfer.findMany({ ...pick(take), where: { status: { in: spellings(["SUBMITTED", "PENDING_APPROVAL", "PENDING"]) } }, select: { id: true, transferNumber: true, createdAt: true } })
      ).map((r) => ({ id: r.id, reference: r.transferNumber, createdAt: r.createdAt })),
  },
  {
    id: "budget",
    module: "Accounts",
    label: "Budget",
    href: "/accounts/budget",
    pipelineFeature: null,
    pending: ["SUBMITTED", "PENDING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async () => {
      const grouped = await db().budget.groupBy({ by: ["approvalStatus"], _count: { _all: true }, _min: { createdAt: true } });
      return grouped.map((g) => ({ status: g.approvalStatus, count: g._count._all, oldest: g._min.createdAt }));
    },
    oldest: async (_units, take) =>
      (await db().budget.findMany({ ...pick(take), where: { approvalStatus: { in: spellings(["SUBMITTED", "PENDING"]) } }, select: { id: true, budgetCode: true, budgetName: true, createdAt: true } })).map((r) => ({
        id: r.id,
        reference: `${r.budgetCode} — ${r.budgetName}`,
        createdAt: r.createdAt,
      })),
  },
  // ── HR & Payroll ──
  {
    id: "employee-leave",
    module: "HR & Payroll",
    label: "Employee Leave",
    href: "/hrm/self-service/leave-movement",
    pipelineFeature: "Employee Leave",
    pending: ["PENDING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().leaveApplication.groupBy({ ...groupArgs, where: employeeInUnits(units) })),
    oldest: async (units, take) =>
      (await db().leaveApplication.findMany({ ...pick(take), where: { ...employeeInUnits(units), status: { in: spellings(["PENDING"]) } }, select: { id: true, leaveType: true, createdAt: true, employee: employeeSelect } })).map((r) => ({
        id: r.id,
        reference: `${employeeRef(r.employee)} · ${r.leaveType}`,
        createdAt: r.createdAt,
      })),
  },
  {
    id: "employee-movement",
    module: "HR & Payroll",
    label: "Employee Movement",
    href: "/hrm/self-service/leave-movement",
    pipelineFeature: "Employee Movement",
    pending: ["PENDING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().movementApplication.groupBy({ ...groupArgs, where: employeeInUnits(units) })),
    oldest: async (units, take) =>
      (await db().movementApplication.findMany({ ...pick(take), where: { ...employeeInUnits(units), status: { in: spellings(["PENDING"]) } }, select: { id: true, createdAt: true, employee: employeeSelect } })).map((r) => ({
        id: r.id,
        reference: employeeRef(r.employee),
        createdAt: r.createdAt,
      })),
  },
  {
    id: "employee-attendance",
    module: "HR & Payroll",
    label: "Employee Attendance",
    href: "/hrm/governance/pending-approval",
    link: "/hrm/governance/pending-approval?kind=attendance",
    pipelineFeature: "Employee Attendance",
    pending: ["PENDING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().attendanceAdjustment.groupBy({ ...groupArgs, where: employeeInUnits(units) })),
    oldest: async (units, take) =>
      (await db().attendanceAdjustment.findMany({ ...pick(take), where: { ...employeeInUnits(units), status: { in: spellings(["PENDING"]) } }, select: { id: true, date: true, createdAt: true, employee: employeeSelect } })).map((r) => ({
        id: r.id,
        reference: `${employeeRef(r.employee)} · ${r.date.toISOString().slice(0, 10)}`,
        createdAt: r.createdAt,
      })),
  },
  {
    id: "overtime",
    module: "HR & Payroll",
    label: "Overtime",
    href: "/hrm/overtime",
    pipelineFeature: "Overtime",
    pending: ["PENDING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().overtimeEntry.groupBy({ ...groupArgs, where: employeeInUnits(units) })),
    oldest: async (units, take) =>
      (await db().overtimeEntry.findMany({ ...pick(take), where: { ...employeeInUnits(units), status: { in: spellings(["PENDING"]) } }, select: { id: true, createdAt: true, employee: employeeSelect } })).map((r) => ({
        id: r.id,
        reference: employeeRef(r.employee),
        createdAt: r.createdAt,
      })),
  },
  {
    id: "salary-sheet",
    module: "HR & Payroll",
    label: "Salary Sheet",
    href: "/hrm/payroll",
    pipelineFeature: "Salary Sheet",
    pending: ["UNDER_PROCESSING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().payrollBatch.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().payrollBatch.findMany({ ...pick(take), where: { ...inUnits(units), status: "Under Processing" }, select: { id: true, reference: true, month: true, version: true, createdAt: true, office: { select: { name: true } } } })).map((r) => ({
        version: String(r.version),
        id: r.id,
        reference: `${r.reference} · ${r.office.name} · ${r.month}`,
        createdAt: r.createdAt,
      })),
  },
  {
    id: "bonus",
    module: "HR & Payroll",
    label: "Bonus",
    href: "/hrm/compensation/bonus",
    pipelineFeature: "Bonus",
    pending: ["PENDING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().bonusRun.groupBy({ ...groupArgs, where: { OR: [{ officeId: null }, { office: { businessUnitId: { in: units } } }] } })),
    oldest: async (units, take) =>
      (
        await db().bonusRun.findMany({
          ...pick(take),
          where: { OR: [{ officeId: null }, { office: { businessUnitId: { in: units } } }], status: { in: spellings(["PENDING"]) } },
          select: { id: true, name: true, createdAt: true },
        })
      ).map((r) => ({ id: r.id, reference: r.name, createdAt: r.createdAt })),
  },
  {
    id: "salary-increment",
    module: "HR & Payroll",
    label: "Salary Increment",
    href: "/hrm/talent/increment",
    pipelineFeature: "Salary Increment",
    pending: ["PENDING"],
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().salaryIncrement.groupBy({ ...groupArgs, where: employeeInUnits(units) })),
    oldest: async (units, take) =>
      (await db().salaryIncrement.findMany({ ...pick(take), where: { ...employeeInUnits(units), status: { in: spellings(["PENDING"]) } }, select: { id: true, incrementType: true, createdAt: true, employee: employeeSelect } })).map((r) => ({
        id: r.id,
        reference: `${employeeRef(r.employee)} · ${r.incrementType}`,
        createdAt: r.createdAt,
      })),
  },
  // ── RTM ──
  {
    id: "rtm-outlet",
    module: "RTM",
    label: "Outlet Setup",
    href: "/rtm/outlet-setup",
    pipelineFeature: "Outlet Setup Approval",
    pending: RTM_PENDING,
    approved: ["APPROVED"],
    rejected: ["REJECTED"],
    counts: async (units) =>
      (await db().rtmOutlet.groupBy({ by: ["approvalStatus"], _count: { _all: true }, _min: { createdAt: true }, where: inUnits(units) })).map((g) => ({
        status: g.approvalStatus,
        count: g._count._all,
        oldest: g._min.createdAt,
      })),
    oldest: async (units, take) =>
      (await db().rtmOutlet.findMany({ ...pick(take), where: { ...inUnits(units), approvalStatus: "PENDING" }, select: { id: true, code: true, name: true, createdAt: true } })).map((r) => ({
        id: r.id,
        reference: `${r.code} · ${r.name}`,
        createdAt: r.createdAt,
      })),
  },
  {
    id: "rtm-stock-transfer",
    module: "RTM",
    label: "Distributor Stock Transfer",
    href: "/rtm/distributor-stock-transfer-request",
    pipelineFeature: "Distributor Stock Transfer",
    pending: RTM_PENDING,
    approved: ["APPROVED", "COMPLETED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().rtmStockTransfer.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().rtmStockTransfer.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING" }, select: { id: true, number: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt })),
  },
  {
    id: "rtm-stock-adjustment",
    module: "RTM",
    label: "Distributor Stock Adjustment",
    href: "/rtm/distributor-stock-adjustment",
    pipelineFeature: "Distributor Stock Adjustment",
    pending: RTM_PENDING,
    approved: ["APPROVED", "COMPLETED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().rtmStockAdjustment.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().rtmStockAdjustment.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING" }, select: { id: true, number: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt })),
  },
  {
    id: "rtm-tour-plan",
    module: "RTM",
    label: "Tour Plan",
    href: "/rtm/tour-plan-setup",
    pipelineFeature: "Tour Plan",
    pending: RTM_PENDING,
    approved: ["APPROVED", "COMPLETED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().rtmTourPlan.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().rtmTourPlan.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING" }, select: { id: true, createdAt: true, employee: employeeSelect } })).map((r) => ({
        id: r.id,
        reference: employeeRef(r.employee),
        createdAt: r.createdAt,
      })),
  },
  {
    id: "rtm-layer-transfer",
    module: "RTM",
    label: "Sales Layer Transfer",
    href: "/rtm/sales-layer-transfer",
    pipelineFeature: "Sales Layer Transfer",
    pending: RTM_PENDING,
    approved: ["APPROVED", "COMPLETED"],
    rejected: ["REJECTED"],
    counts: async (units) => rows(await db().rtmLayerTransfer.groupBy({ ...groupArgs, where: inUnits(units) })),
    oldest: async (units, take) =>
      (await db().rtmLayerTransfer.findMany({ ...pick(take), where: { ...inUnits(units), status: "PENDING" }, select: { id: true, number: true, createdAt: true } })).map((r) => ({ id: r.id, reference: r.number, createdAt: r.createdAt })),
  },
];

function bucket(source: Source, statusRows: StatusRow[]) {
  const pending = new Set(source.pending.map(norm));
  const approved = new Set(source.approved.map(norm));
  const rejected = new Set(source.rejected.map(norm));
  let p = 0;
  let a = 0;
  let r = 0;
  let oldest: Date | null = null;
  for (const row of statusRows) {
    const s = norm(row.status);
    if (pending.has(s)) {
      p += row.count;
      if (row.oldest && (!oldest || row.oldest < oldest)) oldest = row.oldest;
    } else if (approved.has(s)) a += row.count;
    else if (rejected.has(s)) r += row.count;
  }
  return { pending: p, approved: a, rejected: r, oldestPendingAt: oldest?.toISOString() ?? null };
}

/** Production orders waiting for approval, by the stage each is waiting at (its lowest pending stage). */
async function productionStageLoad(units: string[]): Promise<ApprovalStageLoad[]> {
  const stages = await db().productionOrderApproval.findMany({
    where: { status: "PENDING", order: { status: "PENDING_APPROVAL", businessUnitId: { in: units } } },
    select: { orderId: true, stageNo: true, stageName: true },
    orderBy: { stageNo: "asc" },
  });
  const current = new Map<string, { stageNo: number; name: string }>();
  for (const s of stages) if (!current.has(s.orderId)) current.set(s.orderId, { stageNo: s.stageNo, name: s.stageName });
  const byStage = new Map<number, ApprovalStageLoad>();
  for (const { stageNo, name } of current.values()) {
    const entry = byStage.get(stageNo) ?? { stageNo, name, pending: 0 };
    entry.pending += 1;
    byStage.set(stageNo, entry);
  }
  return [...byStage.values()].sort((a, b) => a.stageNo - b.stageNo);
}

/**
 * Documents of a feature that are part-way through their stages (multilayer
 * approval engine), by the stage each is waiting at. Pending documents nobody
 * has acted on yet wait at stage 1, so they are added there by the caller.
 */
async function documentStageLoad(feature: string, units: string[]): Promise<{ load: ApprovalStageLoad[]; inProgress: number }> {
  const aliases = featureAliases(feature);
  const stages = await db().documentApproval.findMany({
    where: { feature: { in: aliases }, status: "PENDING", OR: [{ businessUnitId: null }, { businessUnitId: { in: units } }] },
    select: { documentId: true, stageNo: true, stageName: true },
    orderBy: { stageNo: "asc" },
  });
  const current = new Map<string, { stageNo: number; name: string }>();
  for (const s of stages) if (!current.has(s.documentId)) current.set(s.documentId, { stageNo: s.stageNo, name: s.stageName });
  return { load: tallyStages(current.values()), inProgress: current.size };
}

function tallyStages(current: Iterable<{ stageNo: number; name: string }>): ApprovalStageLoad[] {
  const byStage = new Map<number, ApprovalStageLoad>();
  for (const { stageNo, name } of current) {
    const entry = byStage.get(stageNo) ?? { stageNo, name, pending: 0 };
    entry.pending += 1;
    byStage.set(stageNo, entry);
  }
  return [...byStage.values()].sort((a, b) => a.stageNo - b.stageNo);
}

export async function getApprovalSummary(actor: Actor): Promise<ApprovalSummary> {
  const visible = SOURCES.filter((s) => actor.isMaster || !actor.grants || grantsAllow(actor.grants, s.href, "view"));
  const units = await scopedBusinessUnitIds(actor);

  const [pipelines, results] = await Promise.all([
    db().approvalPipeline.findMany({
      select: {
        id: true,
        name: true,
        feature: true,
        superApproverUserId: true,
        superApproverEmployeeId: true,
        _count: { select: { stages: true } },
        stages: { select: { stageNo: true, name: true }, orderBy: { stageNo: "asc" }, take: 1 },
      },
      // Same pipeline the engine uses when a feature has several: the latest updated.
      orderBy: { updatedAt: "desc" },
    }),
    Promise.all(
      visible.map(async (source) => {
        const [statusRows, oldest, stageLoad, engineLoad] = await Promise.all([
          source.counts(units),
          source.oldest(units, OLDEST_PER_SOURCE),
          source.id === "production-order" ? productionStageLoad(units) : Promise.resolve(null),
          source.pipelineFeature && source.id !== "production-order" ? documentStageLoad(source.pipelineFeature, units) : Promise.resolve(null),
        ]);
        return { source, statusRows, oldest, stageLoad, engineLoad };
      }),
    ),
  ]);

  const pipelineByFeature = new Map<string, (typeof pipelines)[number]>();
  for (const p of pipelines) {
    if (!pipelineByFeature.has(p.feature)) pipelineByFeature.set(p.feature, p);
    for (const alias of featureAliases(p.feature)) {
      if (!pipelineByFeature.has(alias)) pipelineByFeature.set(alias, p);
    }
  }

  const categories: ApprovalCategory[] = results.map(({ source, statusRows, stageLoad: productionLoad, engineLoad }) => {
    const pipeline = source.pipelineFeature ? pipelineByFeature.get(source.pipelineFeature) : undefined;
    const counts = bucket(source, statusRows);
    let stageLoad = productionLoad;
    if (engineLoad && pipeline && pipeline._count.stages > 0) {
      // Pending documents nobody has acted on yet are waiting at the pipeline's first stage.
      const notStarted = Math.max(0, counts.pending - engineLoad.inProgress);
      const first = pipeline.stages[0];
      const load = [...engineLoad.load];
      if (notStarted > 0 && first) {
        const at1 = load.find((s) => s.stageNo === 1);
        if (at1) at1.pending += notStarted;
        else load.unshift({ stageNo: 1, name: first.name, pending: notStarted });
      }
      stageLoad = load;
    }
    return {
      id: source.id,
      module: source.module,
      label: source.label,
      href: source.link ?? source.href,
      ...counts,
      pipelineConfigurable: source.pipelineFeature !== null,
      pipeline: pipeline
        ? { id: pipeline.id, name: pipeline.name, stages: pipeline._count.stages, hasSuperApprover: !!(pipeline.superApproverUserId || pipeline.superApproverEmployeeId) }
        : null,
      stageLoad,
    };
  });

  const oldestPending: PendingDocument[] = results
    .flatMap(({ source, oldest }) =>
      oldest.map((doc) => ({
        id: doc.id,
        categoryId: source.id,
        category: source.label,
        module: source.module,
        href: source.link ?? source.href,
        reference: doc.reference,
        createdAt: doc.createdAt.toISOString(),
      })),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, OLDEST_TOTAL);

  return { generatedAt: new Date().toISOString(), categories, oldestPending };
}

/** Pending documents of one category, oldest first, for approving from the Multilayer Approval page. */
export async function getPendingDocuments(actor: Actor, categoryId: string): Promise<PendingList> {
  const source = SOURCES.find((s) => s.id === categoryId);
  if (!source || !(actor.isMaster || !actor.grants || grantsAllow(actor.grants, source.href, "view"))) throw notFound("Approval category");
  const units = await scopedBusinessUnitIds(actor);
  const docs = await source.oldest(units, LIST_LIMIT + 1);
  return {
    categoryId: source.id,
    truncated: docs.length > LIST_LIMIT,
    documents: docs.slice(0, LIST_LIMIT).map((d) => ({ id: d.id, reference: d.reference, createdAt: d.createdAt.toISOString(), version: d.version ?? null })),
  };
}
