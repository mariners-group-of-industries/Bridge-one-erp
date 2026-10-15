import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ProfilePanelProps {
  id: string;
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Drop the body padding (for panels whose content brings its own, e.g. tabs). */
  flush?: boolean;
}

/** White card with a blue icon badge in the header; one per Company Profile section. */
export function ProfilePanel({ id, icon, title, description, actions, children, className, flush }: ProfilePanelProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-32 overflow-hidden rounded border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-line px-5 py-4">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded bg-accent-soft text-accent-strong dark:text-accent [&_svg]:size-[18px]"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={headingId} className="text-xs font-bold tracking-wide text-ink uppercase">
            {title}
          </h2>
          {description && <p className="text-sm text-ink-faint">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn(!flush && "px-5 py-5")}>{children}</div>
    </section>
  );
}

/** Small "label / value" pair used in the read-only unit and office details. */
export function InfoRow({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="text-sm break-words text-ink">{value}</span>
    </div>
  );
}

export function PanelPlaceholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded border border-dashed border-accent-line bg-accent-soft/40 px-4 py-8 text-center text-sm text-ink-faint">
      {children}
    </p>
  );
}
