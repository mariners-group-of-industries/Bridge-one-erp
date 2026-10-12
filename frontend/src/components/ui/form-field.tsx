"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/** ERPNext-style control: filled grey, borderless, ring on focus. */
export const CONTROL =
  "w-full rounded-md bg-control px-2 text-sm text-ink placeholder:text-ink-faint transition-colors hover:bg-hover focus:bg-surface focus:outline-none focus:ring-1 focus:ring-line-strong focus:shadow-[0_0_0_2px_var(--control)] disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-control";

const INVALID = "ring-1 ring-danger focus:ring-danger";

interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

function FieldShell({ label, required, error, hint, className, children }: FieldShellProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy: error || hint ? messageId : undefined, invalid: !!error })}
      {error ? (
        <p id={messageId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: string; className?: string };

export function TextField({
  label,
  error,
  hint,
  className,
  required,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "h-7", invalid && INVALID)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  className,
  required,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "min-h-16 py-1.5", invalid && INVALID)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  required,
  options,
  ...props
}: Common &
  SelectHTMLAttributes<HTMLSelectElement> & { options: readonly { value: string; label: string }[] }) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "h-7", invalid && INVALID)}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

/** Bare checkbox, for grids and list selection. */
export function Checkbox({
  className,
  tone = "default",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** "accent" draws the checkbox in blue, for checklist grids. */
  tone?: "default" | "accent";
}) {
  return (
    <input
      type="checkbox"
      className={cn(
        "cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-60",
        tone === "accent" ? "size-4 accent-(--accent-strong)" : "size-3.5 accent-(--primary)",
        className,
      )}
      {...props}
    />
  );
}

/** ERPNext "Check" field: checkbox with its label on the right. */
export function CheckboxField({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-ink">
        <Checkbox id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Read-only value laid out like a field (for read-only forms and detail panes). */
export function ReadOnlyField({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="min-h-7 py-1 text-sm whitespace-pre-line text-ink">{value || "—"}</span>
    </div>
  );
}
