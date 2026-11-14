import { apiRequest } from "@/lib/api/client";
import type { ApprovalSummary } from "../types";

export function fetchApprovalSummary(): Promise<ApprovalSummary> {
  return apiRequest<ApprovalSummary>("/api/approvals/summary");
}
