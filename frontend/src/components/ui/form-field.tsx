"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const CONTROL =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 disabled:bg-zinc-100";

interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

function FieldShell({ label, required, error, hint, className = "", children }: FieldShellProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, describedBy: error || hint ? messageId : undefined, invalid: !!error })}
      {error ? (
        <p id={messageId} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-zinc-500">
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
          className={`${CONTROL} ${invalid ? "border-red-500" : "border-zinc-300"}`}
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
          className={`${CONTROL} min-h-20 ${invalid ? "border-red-500" : "border-zinc-300"}`}
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
  SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${CONTROL} ${invalid ? "border-red-500" : "border-zinc-300"}`}
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
