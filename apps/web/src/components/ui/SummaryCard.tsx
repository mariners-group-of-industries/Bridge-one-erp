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
  let iconBg = "bg-slate-100 text-slate-700";
  let borderLeft = "border-l-sky-500";

  switch (variant) {
    case "success":
      iconBg = "bg-emerald-100 text-emerald-700";
      borderLeft = "border-l-emerald-500";
      break;
    case "warning":
      iconBg = "bg-amber-100 text-amber-700";
      borderLeft = "border-l-amber-500";
      break;
    case "danger":
      iconBg = "bg-rose-100 text-rose-700";
      borderLeft = "border-l-rose-500";
      break;
    case "info":
      iconBg = "bg-sky-100 text-sky-700";
      borderLeft = "border-l-sky-500";
      break;
  }

  return (
    <div
      className={cn(
        "bg-white p-3.5 rounded border border-slate-200 shadow-sm border-l-4 transition-all hover:shadow",
        borderLeft,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
          {title}
        </span>
        {Icon && (
          <div className={cn("p-1.5 rounded-full shrink-0", iconBg)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xl font-bold text-slate-800 tracking-tight">{value}</div>
        {badge && (
          <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-slate-400 mt-1 truncate">{subtitle}</p>}
    </div>
  );
}
