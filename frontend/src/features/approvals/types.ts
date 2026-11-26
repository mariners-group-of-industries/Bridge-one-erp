// Multilayer Approval summary: every document type that goes through approval,
// grouped by module, with its pending / approved / rejected counts and the
// approval pipeline (Configuration › Approval Setup) configured for it.

export interface ApprovalStageLoad {
  stageNo: number;
  name: string;
  /** Documents currently waiting at this stage. */
  pending: number;
}

export interface ApprovalCategory {
  /** Stable id, e.g. "purchase-requisition". */
  id: string;
  module: string;
  label: string;
  /** Page where the documents are approved. */
  href: string;
  pending: number;
  approved: number;
  rejected: number;
  /** ISO date-time of the oldest pending document, or null. */
  oldestPendingAt: string | null;
  /** False when Approval Setup has no pipeline option for this document (approved by page permission only). */
  pipelineConfigurable: boolean;
  /** Approval pipeline set up for this feature, or null when none is. */
  pipeline: { id: string; name: string; stages: number; hasSuperApprover: boolean } | null;
  /** Per-stage queue, for documents that record their stages (Production Order). */
  stageLoad: ApprovalStageLoad[] | null;
}

export interface PendingDocument {
  id: string;
  categoryId: string;
  category: string;
  module: string;
  href: string;
  reference: string;
  createdAt: string;
}

export interface ApprovalSummary {
  generatedAt: string;
  categories: ApprovalCategory[];
  /** Oldest pending documents across every category the user may see. */
  oldestPending: PendingDocument[];
}

/** One pending document, as listed when a category is opened on the Multilayer Approval page. */
export interface PendingListDocument {
  id: string;
  reference: string;
  createdAt: string;
  /** Optimistic-lock token the module's approve endpoint expects, when it needs one. */
  version: string | null;
}

export interface PendingList {
  categoryId: string;
  documents: PendingListDocument[];
  /** True when more documents are pending than were listed. */
  truncated: boolean;
}
