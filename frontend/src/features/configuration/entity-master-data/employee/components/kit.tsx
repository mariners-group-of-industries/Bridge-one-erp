"use client";

/**
 * Shared building blocks for the Employee screens (list, create, profile tabs),
 * so every form, card and grid in the feature looks and behaves the same.
 * Semantic colour tokens only.
 */

import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

// ─── Controls ─────────────────────────────────────────────────────────────────

export const CONTROL_CLASS =
  "h-8 w-full rounded border border-line-strong bg-surface px-2.5 text-[12px] text-ink " +
  "placeholder:text-ink-faint transition-colors " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent " +
  "disabled:cursor-not-allowed disabled:bg-control disabled:text-ink-faint " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_CLASS, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_CLASS, "h-auto min-h-20 resize-y py-1.5", className)} {...props} />;
}

type Option = string | { value: string; label: string };

export function Select({
  options,
  placeholder = "Select…",
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: readonly Option[]; placeholder?: string | false }) {
  return (
    <select className={cn(CONTROL_CLASS, "pr-7", className)} {...props}>
      {placeholder !== false && <option value="">{placeholder}</option>}
      {options.map((option) =>
        typeof option === "string" ? (
          <option key={option} value={option}>
            {option}
          </option>
        ) : (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ),
      )}
    </select>
  );
}

/** Numeric text input that accepts digits and one decimal point. */
export function DecimalInput({
  value,
  onValueChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder="0.00"
      value={value}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "" || /^\d*\.?\d*$/.test(raw)) onValueChange(raw);
      }}
      className="text-right tabular-nums"
      {...props}
    />
  );
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-ink select-none", className)}>
      <input type="checkbox" className="size-4 shrink-0 cursor-pointer rounded accent-(--accent-strong)" {...props} />
      {label}
    </label>
  );
}

// ─── Field layout ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  /** Number of grid columns the field spans ("full" = whole row). */
  span?: 2 | 3 | "full";
  className?: string;
  /** Receives the id to put on the control so the label is associated with it. */
  children: ReactNode | ((id: string) => ReactNode);
}

const SPAN = { 2: "sm:col-span-2", 3: "sm:col-span-2 lg:col-span-3", full: "col-span-full" } as const;

/** Label + control + error/hint. Pass a function child to wire the label to the control. */
export function Field({ label, required, error, hint, span, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", span && SPAN[span], className)}>
      <label htmlFor={typeof children === "function" ? id : undefined} className="text-xs font-medium text-ink-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {typeof children === "function" ? children(id) : children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const COLS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function FormGrid({ cols = 4, className, children }: { cols?: keyof typeof COLS; className?: string; children: ReactNode }) {
  return <div className={cn("grid gap-x-5 gap-y-4", COLS[cols], className)}>{children}</div>;
}

/** Read-only value laid out like a field. */
export function ReadValue({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <span className="min-h-5 text-sm break-words text-ink">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

// ─── Panels ───────────────────────────────────────────────────────────────────

interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons or badges on the right of the header. */
  actions?: ReactNode;
  /** Sticky action bar at the bottom of the panel. */
  footer?: ReactNode;
  /** Keep the footer visible at the bottom of the viewport while the panel scrolls. */
  stickyFooter?: boolean;
  /** Remove body padding (for tables that run edge to edge). */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/** White card with an optional header and footer; the standard container for every section. */
export function Panel({ title, description, actions, footer, stickyFooter, flush, className, children }: PanelProps) {
  return (
    <section className={cn("rounded border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            {title && <h2 className="text-xs font-bold tracking-wide text-ink uppercase">{title}</h2>}
            {description && <p className="text-xs text-ink-faint">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "px-5 py-4")}>{children}</div>
      {footer && (
        <footer
          className={cn(
            "flex flex-wrap items-center justify-end gap-2 rounded-b border-t border-line bg-canvas px-5 py-2.5",
            stickyFooter && "sticky bottom-0 z-10 bg-canvas/95 backdrop-blur",
          )}
        >
          {footer}
        </footer>
      )}
    </section>
  );
}

/** Sub-heading inside a panel that separates groups of fields. */
export function PanelSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 not-first:mt-5 not-first:border-t not-first:border-line not-first:pt-4", className)}>
      <h3 className="text-xs font-semibold tracking-wide text-accent-strong uppercase dark:text-accent">{title}</h3>
      {children}
    </div>
  );
}

/** Left side of a sticky save bar: tells the user whether there is anything to save. */
export function SaveState({ dirty }: { dirty: boolean }) {
  return (
    <p className={cn("mr-auto text-xs", dirty ? "font-medium text-warning" : "text-ink-faint")}>
      {dirty ? "Unsaved changes" : "No unsaved changes"}
    </p>
  );
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded border px-3 py-2 text-sm",
        tone === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-success/30 bg-success/5 text-success",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyBlock({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-line px-4 py-10 text-center">
      {icon && <span className="text-ink-faint [&_svg]:size-7">{icon}</span>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="text-sm text-ink-faint">{children}</div>}
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-2 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase",
        active ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/** Initials avatar used in the list, drawer and profile header. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong dark:text-accent",
        size === "sm" && "size-7 text-xs",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-14 text-lg",
      )}
    >
      {initials}
    </span>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export const TABLE = {
  wrap: "overflow-x-auto rounded border border-grid-line",
  table: "w-full border-collapse text-[12px]",
  head: "border-b-2 border-grid-head-rule bg-grid-head text-left text-[11px] tracking-wide text-grid-head-ink uppercase",
  th: "border-r border-grid-head-line px-2.5 py-2 font-bold whitespace-nowrap last:border-r-0",
  row: "border-t border-grid-line hover:bg-grid-hover",
  td: "border-r border-grid-line px-2.5 py-2 text-ink last:border-r-0",
} as const;
