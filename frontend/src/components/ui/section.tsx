import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

/** White bordered surface; form views and list views sit inside one. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded border border-line bg-surface shadow-xs", className)}>{children}</div>;
}

interface SectionProps {
  id?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * ERPNext form section. Consecutive sections inside a <Card> are separated by a
 * rule; the title is optional (untitled sections just group fields).
 */
export function Section({ id, title, description, actions, children, className }: SectionProps) {
  const headingId = id && title ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-4 px-4 py-4 not-first:border-t not-first:border-line", className)}
    >
      {(title || actions) && (
        <header className="flex flex-col gap-2 border-b border-line pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            {title && (
              <h2 id={headingId} className="text-xs font-bold tracking-wide text-ink uppercase">
                {title}
              </h2>
            )}
            {description && <p className="text-xs text-ink-faint">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Two-column field grid used by every form view (stacks on small screens). */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-8 gap-y-4 md:grid-cols-2", className)}>{children}</div>;
}

export function EmptyState({ title, icon, children }: { title: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {icon && <div className="text-ink-faint [&_svg]:size-8">{icon}</div>}
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {children && <div className="text-sm text-ink-faint">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex justify-center py-10 text-ink-faint">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm">
      <p className="text-danger">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium text-ink underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}
