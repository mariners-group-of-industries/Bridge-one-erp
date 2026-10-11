import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page content width/padding shared by workspace, list and form views. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6", className)}>{children}</div>;
}

interface PageHeadProps {
  title: ReactNode;
  /** Status pill next to the title (e.g. <Indicator>Not Saved</Indicator>). */
  indicator?: ReactNode;
  /** Small text under the title. */
  subtitle?: ReactNode;
  /** Buttons on the right; the primary action goes last. */
  actions?: ReactNode;
}

/** ERPNext page head: sticky title bar with status indicator and actions. */
export function PageHead({ title, indicator, subtitle, actions }: PageHeadProps) {
  return (
    <div className="sticky top-12 z-20 -mx-4 mb-4 bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold text-ink">{title}</h1>
            {indicator}
          </div>
          {subtitle && <p className="truncate text-sm text-ink-faint">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
