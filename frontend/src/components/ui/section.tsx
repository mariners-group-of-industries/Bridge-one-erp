import type { ReactNode } from "react";
import { Spinner } from "./spinner";

interface SectionProps {
  id?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ id, title, description, actions, children }: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="rounded-lg border border-zinc-200 bg-white shadow-xs"
    >
      <header className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-base font-semibold text-zinc-900">
            {title}
          </h2>
          {description && <p className="text-sm text-zinc-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center">
      <p className="text-sm font-medium text-zinc-800">{title}</p>
      {children && <div className="text-sm text-zinc-600">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex justify-center py-8 text-blue-700">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-md bg-red-50 px-4 py-6 text-center text-sm text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}
