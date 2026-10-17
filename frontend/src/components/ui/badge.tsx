import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "warning" | "danger" | "primary";
}

const STYLES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "border-line-strong bg-control text-ink-muted",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  primary: "border-accent-line bg-accent-soft text-accent-strong dark:text-accent",
};

export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        STYLES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
