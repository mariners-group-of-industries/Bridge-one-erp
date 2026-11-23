import { ApiClientError, apiRequest } from "@/lib/api/client";
import { localToday } from "@/features/purchase/lib/client";
import type { PendingList, PendingListDocument } from "../types";

/**
 * Approve / reject from the Multilayer Approval page.
 *
 * Every call goes to the same endpoint the module's own page uses, so the
 * module's permission checks, approval pipeline stages, stock postings and
 * status changes all apply exactly as they do there. A document under a
 * multi-stage pipeline stays pending until its last stage approves.
 */

export type Decision = "approve" | "reject";

export interface DecisionInput {
  doc: PendingListDocument;
  /** Comment on approve; reason on reject. */
  remarks: string;
}

interface CategoryActions {
  approve: (input: DecisionInput) => Promise<unknown>;
  /** Absent when the module has no reject action for this document. */
  reject?: (input: DecisionInput) => Promise<unknown>;
}

export function fetchPendingDocuments(categoryId: string): Promise<PendingList> {
  return apiRequest<PendingList>(`/api/approvals/${encodeURIComponent(categoryId)}/pending`);
}

const post = (path: string, body?: unknown) => apiRequest<unknown>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const id = (doc: PendingListDocument) => encodeURIComponent(doc.id);

/** Older account endpoints answer `{ success, data } | { success: false, error: "message" }`. */
async function legacy(path: string, method: "PATCH" | "PUT", body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Unable to reach the server. Check your connection.");
  }
  const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: unknown; error?: string | { message?: string } } | null;
  if (!response.ok || !payload || payload.success === false || payload.error) {
    const message = typeof payload?.error === "string" ? payload.error : (payload?.error?.message ?? `Request failed (${response.status}).`);
    throw new ApiClientError(response.status, response.status === 403 ? "FORBIDDEN" : response.status === 404 ? "NOT_FOUND" : response.status === 409 ? "CONFLICT" : response.status < 500 ? "VALIDATION_ERROR" : "INTERNAL_ERROR", message);
  }
  return payload.data;
}

function needVersion(doc: PendingListDocument): string {
  if (!doc.version) throw new ApiClientError(409, "CONFLICT", `${doc.reference} changed. Refresh and try again.`);
  return doc.version;
}

/** POST …/{id}/approve and …/{id}/reject with an optional comment body. */
function idRoutes(base: string, body?: (input: DecisionInput) => unknown): CategoryActions {
  return {
    approve: (input) => post(`${base}/${id(input.doc)}/approve`, body?.(input)),
    reject: (input) => post(`${base}/${id(input.doc)}/reject`, body?.(input)),
  };
}

const inventory = (slug: string) => idRoutes(`/api/inventory/${slug}`, ({ remarks }) => ({ comment: remarks }));

const ACTIONS: Record<string, CategoryActions> = {
  // ── Purchase ──
  "purchase-requisition": idRoutes("/api/v1/purchase/requisitions", ({ remarks }) => ({ comments: remarks })),
  "purchase-order": { approve: ({ doc, remarks }) => post(`/api/v1/purchase/orders/${id(doc)}/approve`, { comments: remarks }) },
  "supplier-bill": { approve: ({ doc }) => post(`/api/v1/purchase/supplier-bills/${id(doc)}/approve`, {}) },
  // ── Sales ──
  "sales-order": {
    approve: ({ doc, remarks }) => post(`/api/sales/orders/${id(doc)}/status`, { action: "approve", version: needVersion(doc), remarks: remarks || undefined, today: localToday() }),
    reject: ({ doc, remarks }) => post(`/api/sales/orders/${id(doc)}/status`, { action: "reject", version: needVersion(doc), remarks, today: localToday() }),
  },
  "sales-return": { approve: ({ doc }) => post(`/api/sales/returns/${id(doc)}/approve`, { version: needVersion(doc) }) },
  // ── Inventory ──
  "stock-adjustment": inventory("stock-adjustment"),
  "transfer-request": inventory("transfer-request"),
  "store-requisition": inventory("store-requisition"),
  "item-conversion": inventory("item-stock-conversion"),
  // ── Production ──
  "production-order": {
    approve: ({ doc, remarks }) => post(`/api/production/orders/${id(doc)}/actions`, { action: "approve", version: needVersion(doc), comment: remarks || undefined }),
    reject: ({ doc, remarks }) => post(`/api/production/orders/${id(doc)}/actions`, { action: "reject", version: needVersion(doc), comment: remarks }),
  },
  // ── Accounts ──
  "journal-voucher": { approve: ({ doc }) => legacy(`/api/accounts/journal/${id(doc)}`, "PATCH", { action: "POST" }) },
  expense: {
    approve: ({ doc }) => legacy(`/api/accounts/expenses/${id(doc)}`, "PATCH", { status: "APPROVED" }),
    reject: ({ doc }) => legacy(`/api/accounts/expenses/${id(doc)}`, "PATCH", { status: "REJECTED" }),
  },
  "fund-transfer": { approve: ({ doc }) => legacy(`/api/accounts/fund-transfers/${id(doc)}`, "PATCH", { action: "APPROVE" }) },
  budget: {
    approve: ({ doc }) => legacy(`/api/accounts/budget/${id(doc)}`, "PUT", { status: "Approved", approvalStatus: "Approved" }),
    reject: ({ doc }) => legacy(`/api/accounts/budget/${id(doc)}`, "PUT", { status: "Rejected", approvalStatus: "Rejected" }),
  },
  // ── HR & Payroll ──
  "employee-leave": idRoutes("/api/hrm/self-service/leaves"),
  "employee-movement": idRoutes("/api/hrm/self-service/movements"),
  "employee-attendance": idRoutes("/api/hrm/governance/pending/attendance"),
  overtime: {
    approve: ({ doc }) => post("/api/hrm/overtime/approve", { ids: [doc.id] }),
    reject: ({ doc }) => post("/api/hrm/overtime/reject", { ids: [doc.id] }),
  },
  "salary-sheet": {
    approve: ({ doc, remarks }) => post(`/api/hrm/payroll/batches/${id(doc)}/decision`, { decision: "approve", remarks, version: Number(needVersion(doc)) }),
    reject: ({ doc, remarks }) => post(`/api/hrm/payroll/batches/${id(doc)}/decision`, { decision: "reject", remarks, version: Number(needVersion(doc)) }),
  },
  bonus: idRoutes("/api/hrm/bonus"),
  "salary-increment": idRoutes("/api/hrm/increments"),
  // ── RTM ──
  "rtm-stock-transfer": idRoutes("/api/rtm/distributor-stock-transfer-request"),
  "rtm-stock-adjustment": idRoutes("/api/rtm/distributor-stock-adjustment"),
  "rtm-tour-plan": idRoutes("/api/rtm/tour-plan-setup"),
  "rtm-layer-transfer": idRoutes("/api/rtm/sales-layer-transfer"),
};

/** Whether this page can decide documents of the category itself (false = only the module page can). */
export function canDecideHere(categoryId: string, decision: Decision): boolean {
  const actions = ACTIONS[categoryId];
  return decision === "approve" ? !!actions : !!actions?.reject;
}

export function decide(categoryId: string, decision: Decision, input: DecisionInput): Promise<unknown> {
  const actions = ACTIONS[categoryId];
  const run = decision === "approve" ? actions?.approve : actions?.reject;
  if (!run) return Promise.reject(new ApiClientError(400, "VALIDATION_ERROR", "Open the module page to do this."));
  return run(input);
}
