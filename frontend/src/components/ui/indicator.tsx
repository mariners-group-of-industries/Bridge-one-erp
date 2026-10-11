import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type IndicatorColor = "gray" | "green" | "red" | "orange" | "blue" | "yellow" | "purple";

const COLORS: Record<IndicatorColor, string> = {
  gray: "bg-control text-ink-muted",
  green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  yellow: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

/** ERPNext status pill ("Enabled", "Draft", "Not Saved" …). */
export function Indicator({
  color = "gray",
  children,
  className,
}: {
  color?: IndicatorColor;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        COLORS[color],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
