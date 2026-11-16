import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: string;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  className,
  variant = "default",
}: SummaryCardProps) {
  let iconBg = "bg-control text-ink-muted";
  let borderLeft = "border-l-sky-500";

  switch (variant) {
    case "success":
      iconBg = "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
      borderLeft = "border-l-emerald-500";
      break;
    case "warning":
      iconBg = "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300";
      borderLeft = "border-l-amber-500";
      break;
    case "danger":
      iconBg = "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300";
      borderLeft = "border-l-rose-500";
      break;
    case "info":
      iconBg = "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300";
      borderLeft = "border-l-sky-500";
      break;
  }

  return (
    <div
      className={cn(
        "bg-surface p-3.5 rounded border border-line shadow-xs border-l-4 transition-all hover:shadow-sm",
        borderLeft,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider truncate">
          {title}
        </span>
        {Icon && (
          <div className={cn("p-1.5 rounded-full shrink-0", iconBg)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xl font-bold text-ink tracking-tight">{value}</div>
        {badge && (
          <span className="text-[10px] font-medium bg-control text-ink-muted px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-ink-faint mt-1 truncate">{subtitle}</p>}
    </div>
  );
}
