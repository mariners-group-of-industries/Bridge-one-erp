import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  let styles = "bg-control text-ink-muted border-line";

  switch (normalized) {
    case "APPROVED":
    case "COMPLETED":
    case "RECEIVED":
    case "PAID":
      styles = "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30";
      break;

    case "PENDING_APPROVAL":
    case "SUBMITTED":
    case "PARTIALLY_RECEIVED":
    case "PARTIALLY_RETURNED":
    case "PARTIALLY_PAID":
      styles = "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30";
      break;

    case "DRAFT":
      styles = "bg-control text-ink-muted border-line";
      break;

    case "CONVERTED_TO_PO":
      styles = "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30";
      break;

    case "REJECTED":
    case "CANCELLED":
    case "OVERDUE":
    case "FULLY_RETURNED":
      styles = "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30";
      break;

    case "UNPAID":
      styles = "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30";
      break;
  }

  const label = normalized.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border uppercase",
        styles,
        className
      )}
    >
      {label}
    </span>
  );
}
