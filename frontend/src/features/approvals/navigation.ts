import { ListChecks } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";

export const multilayerApproval: NavLink = {
  label: "Multilayer Approval",
  href: "/approvals",
  description: "Summary of every approval queue, by category.",
  keywords: ["approval", "approvals", "pending", "multilayer", "pipeline", "stage", "queue"],
};

/**
 * Multilayer Approval: one page, linked straight from the sidebar (next to
 * Home) rather than listed with the modules.
 */
export const approvalsWorkspace: Workspace = {
  id: "approvals",
  label: "Multilayer Approval",
  icon: ListChecks,
  href: multilayerApproval.href,
  description: multilayerApproval.description ?? "",
  status: "active",
  shortcuts: [multilayerApproval],
};
