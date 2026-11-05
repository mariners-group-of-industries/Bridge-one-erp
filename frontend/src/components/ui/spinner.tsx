import { cn } from "@/lib/cn";

/** Full-screen loading state, used while signing in and while the desk confirms the session. */
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas">
      <div className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white px-4 py-2 shadow-xs dark:border-slate-700">
        {/* eslint-disable-next-line @next/next/no-img-element -- same static logo as the login card */}
        <img src="/logo.png" alt="BridgeOne ERP" className="h-8 w-auto object-contain" />
      </div>
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        <svg className="size-4 animate-spin text-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {label}
      </span>
    </div>
  );
}

export function Spinner({ className = "size-5", label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <svg className={cn("animate-spin text-current", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm text-ink-faint">{label}</span>}
    </span>
  );
}
