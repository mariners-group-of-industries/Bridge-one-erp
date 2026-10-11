import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  let styles = "bg-slate-100 text-slate-700 border-slate-200";

  switch (normalized) {
    case "APPROVED":
    case "COMPLETED":
    case "RECEIVED":
    case "PAID":
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;

    case "PENDING_APPROVAL":
    case "SUBMITTED":
    case "PARTIALLY_RECEIVED":
    case "PARTIALLY_RETURNED":
    case "PARTIALLY_PAID":
      styles = "bg-amber-50 text-amber-700 border-amber-200";
      break;

    case "DRAFT":
      styles = "bg-slate-100 text-slate-600 border-slate-200";
      break;

    case "CONVERTED_TO_PO":
      styles = "bg-sky-50 text-sky-700 border-sky-200";
      break;

    case "REJECTED":
    case "CANCELLED":
    case "OVERDUE":
    case "FULLY_RETURNED":
      styles = "bg-rose-50 text-rose-700 border-rose-200";
      break;

    case "UNPAID":
      styles = "bg-orange-50 text-orange-700 border-orange-200";
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
