import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "accent" | "accent-soft" | "danger" | "ghost";
type Size = "sm" | "md" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50",
  secondary: "bg-control text-ink hover:bg-hover disabled:text-ink-faint",
  accent: "bg-accent-strong text-white hover:opacity-90 disabled:opacity-50",
  "accent-soft": "bg-accent-soft text-accent-strong hover:bg-accent-line disabled:opacity-50 dark:text-accent",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
  ghost: "text-ink-muted hover:bg-control hover:text-ink disabled:text-ink-faint",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2 text-xs",
  md: "h-8 gap-1.5 px-3 text-sm",
  icon: "size-7",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function buttonClasses(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
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
