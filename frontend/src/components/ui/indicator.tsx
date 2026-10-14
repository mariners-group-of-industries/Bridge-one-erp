import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type IndicatorColor = "gray" | "green" | "red" | "orange" | "blue" | "yellow" | "purple";

const COLORS: Record<IndicatorColor, string> = {
  gray: "border-line-strong bg-control text-ink-muted",
  green: "border-success/30 bg-success/10 text-success",
  red: "border-danger/30 bg-danger/10 text-danger",
  orange: "border-warning/30 bg-warning/10 text-warning",
  blue: "border-accent-line bg-accent-soft text-accent-strong dark:text-accent",
  yellow: "border-warning/30 bg-warning/10 text-warning",
  purple: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300",
};

/** Status pill ("Enabled", "Draft", "Not Saved" …), in the Purchase module style. */
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
        "inline-flex h-5 items-center rounded border px-2 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase",
        COLORS[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
