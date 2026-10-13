import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Breadcrumb } from "@/lib/navigation/types";

/** Page content width/padding shared by workspace, list and form views. */
export function PageContainer({ children, className, full }: { children: ReactNode; className?: string; full?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 pb-10 sm:px-6", !full && "max-w-7xl", className)}>{children}</div>;
}

interface PageHeadProps {
  title: ReactNode;
  indicator?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: readonly Breadcrumb[];
  className?: string;
}

export function PageHead({ title, indicator, subtitle, actions, breadcrumbs, className }: PageHeadProps) {
  return (
    <div className={cn("sticky top-14 z-20 -mx-4 mb-4 bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <PageBreadcrumbs crumbs={breadcrumbs} />}
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

function PageBreadcrumbs({ crumbs }: { crumbs: readonly Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden="true">/</span>}
              {last ? (
                <span aria-current="page" className="font-medium text-ink-muted">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="rounded hover:text-ink hover:underline focus-visible:outline-2">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
