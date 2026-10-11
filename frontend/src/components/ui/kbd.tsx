import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center rounded border border-line-strong bg-surface px-1.5 font-sans text-[10px] font-medium text-ink-faint">
      {children}
    </kbd>
  );
}
