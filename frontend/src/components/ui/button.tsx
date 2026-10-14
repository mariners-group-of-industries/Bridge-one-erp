import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "accent" | "accent-soft" | "danger" | "ghost";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg shadow-xs hover:bg-primary-hover disabled:opacity-50",
  secondary: "border border-line-strong bg-surface text-ink-muted shadow-xs hover:bg-control hover:text-ink disabled:text-ink-faint",
  accent: "bg-accent-strong text-white shadow-xs hover:bg-primary-hover disabled:opacity-50",
  "accent-soft": "border border-accent-line bg-accent-soft text-accent-strong hover:bg-accent-line disabled:opacity-50 dark:text-accent",
  danger: "bg-danger text-white shadow-xs hover:opacity-90 disabled:opacity-50",
  ghost: "text-ink-muted hover:bg-control hover:text-ink disabled:text-ink-faint",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-1.5 px-3 text-xs",
  icon: "size-7",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function buttonClasses(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed [&_svg]:size-3.5 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}
