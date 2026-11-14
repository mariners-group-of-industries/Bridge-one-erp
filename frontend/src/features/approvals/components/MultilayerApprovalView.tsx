"use client";

import { ArrowUpRight, CheckCircle2, Clock, Hourglass, Layers, RefreshCw, Settings2, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { accountWorkspace } from "@/features/accounts/navigation";
import { hrmWorkspace } from "@/features/hrm/navigation";
import { inventoryWorkspace } from "@/features/inventory/navigation";
import { productionWorkspace } from "@/features/production/navigation";
import { purchaseWorkspace } from "@/features/purchase/navigation";
import { rtmWorkspace } from "@/features/rtm/navigation";
import { salesWorkspace } from "@/features/sales/navigation";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { fetchApprovalSummary } from "../services/summary.api";
import type { ApprovalCategory, ApprovalSummary, PendingDocument } from "../types";

const APPROVAL_SETUP = "/configuration/security/approval-setup";
const MODULE_ORDER = ["Purchase", "Sales", "Inventory", "Production", "Accounts", "HR & Payroll", "RTM"];
const MODULE_ICON: Record<string, (typeof purchaseWorkspace)["icon"]> = {
  Purchase: purchaseWorkspace.icon,
  Sales: salesWorkspace.icon,
  Inventory: inventoryWorkspace.icon,
  Production: productionWorkspace.icon,
  Accounts: accountWorkspace.icon,
  "HR & Payroll": hrmWorkspace.icon,
  RTM: rtmWorkspace.icon,
};

const DAY_MS = 86_400_000;
const nf = new Intl.NumberFormat("en-US");

/** Whole days between two ISO timestamps. */
const daysBetween = (from: string, to: string) => Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS));
function ageLabel(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${nf.format(days)} days`;
}
/** Amber after 3 days, rose after 7. */
const ageTone = (days: number) => (days >= 7 ? "text-danger" : days >= 3 ? "text-warning" : "text-ink-muted");

type Filter = "all" | (typeof MODULE_ORDER)[number];

export function MultilayerApprovalView() {
  const summary = useResource("approval-summary", fetchApprovalSummary, { refreshOnFocus: true });
  const { can } = useSession();

  return (
    <PageContainer full>
      <PageHead
        title="Multilayer Approval"
        subtitle="Every approval queue across the modules, grouped by category."
        actions={
          <>
            {can(APPROVAL_SETUP) && (
              <Link href={APPROVAL_SETUP} className={buttonClasses("secondary", "md", "min-h-8")}>
                <Settings2 aria-hidden="true" />
                Approval Setup
              </Link>
            )}
            <Button variant="primary" onClick={summary.reload} loading={summary.loading && !!summary.data}>
              {!(summary.loading && summary.data) && <RefreshCw aria-hidden="true" />}
              Refresh
            </Button>
          </>
        }
      />
      {summary.error && !summary.data ? (
        <Card>
          <ErrorState message={errorMessage(summary.error)} onRetry={summary.reload} />
        </Card>
      ) : !summary.data ? (
        <Card>
          <LoadingState label="Loading approvals…" />
        </Card>
      ) : (
        <Summary data={summary.data} refreshing={summary.loading} />
      )}
    </PageContainer>
  );
}

function Summary({ data, refreshing }: { data: ApprovalSummary; refreshing: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingOnly, setPendingOnly] = useState(false);

  const modules = useMemo(() => {
    const byModule = new Map<string, ApprovalCategory[]>();
    for (const c of data.categories) byModule.set(c.module, [...(byModule.get(c.module) ?? []), c]);
    return MODULE_ORDER.filter((m) => byModule.has(m)).map((module) => {
      const categories = byModule.get(module) ?? [];
      return { module, categories, pending: categories.reduce((s, c) => s + c.pending, 0) };
    });
  }, [data.categories]);

  const totals = useMemo(() => {
    const t = { pending: 0, approved: 0, rejected: 0, withPipeline: 0, configurable: 0, oldest: null as string | null };
    for (const c of data.categories) {
      t.pending += c.pending;
      t.approved += c.approved;
      t.rejected += c.rejected;
      if (c.pipelineConfigurable) t.configurable += 1;
      if (c.pipeline) t.withPipeline += 1;
      if (c.oldestPendingAt && (!t.oldest || c.oldestPendingAt < t.oldest)) t.oldest = c.oldestPendingAt;
    }
    return t;
  }, [data.categories]);

  if (data.categories.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-4 py-14 text-center">
        <Layers aria-hidden="true" className="size-6 text-ink-faint" />
        <p className="text-sm font-semibold text-ink">No approval categories to show</p>
        <p className="max-w-sm text-xs text-ink-muted">You don&apos;t have access to any page where documents are approved. Ask an administrator for access.</p>
      </Card>
    );
  }

  const shown = modules
    .filter((m) => filter === "all" || m.module === filter)
    .map((m) => ({ ...m, categories: pendingOnly ? m.categories.filter((c) => c.pending > 0) : m.categories }))
    .filter((m) => m.categories.length > 0);
  const oldestDays = totals.oldest ? daysBetween(totals.oldest, data.generatedAt) : null;

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", refreshing && "opacity-70")} aria-busy={refreshing}>
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Hourglass />} tone="warning" label="Awaiting approval" value={nf.format(totals.pending)} hint={`across ${modules.filter((m) => m.pending > 0).length} of ${modules.length} modules`} />
        <Kpi
          icon={<Clock />}
          tone={oldestDays !== null && oldestDays >= 7 ? "danger" : "neutral"}
          label="Oldest pending"
          value={oldestDays === null ? "—" : ageLabel(oldestDays)}
          hint={oldestDays === null ? "Nothing is waiting" : "since it was raised"}
        />
        <Kpi icon={<CheckCircle2 />} tone="success" label="Approved" value={nf.format(totals.approved)} hint={`${nf.format(totals.rejected)} rejected`} />
        <Kpi icon={<Layers />} tone="accent" label="Pipelines configured" value={`${totals.withPipeline} / ${totals.configurable}`} hint="categories with approval stages" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filter by module" className="flex flex-wrap gap-1.5">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={totals.pending} />
              {modules.map((m) => (
                <FilterChip key={m.module} active={filter === m.module} onClick={() => setFilter(m.module)} label={m.module} count={m.pending} />
              ))}
            </div>
            <label className="ml-auto flex min-h-8 cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted select-none">
              <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} className="size-4 rounded border-line-strong accent-blue-600" />
              Only with pending
            </label>
          </div>

          {shown.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <CheckCircle2 aria-hidden="true" className="size-6 text-success" />
              <p className="text-sm font-semibold text-ink">Nothing is waiting here</p>
              <p className="text-xs text-ink-muted">No document in this selection is pending approval.</p>
            </Card>
          ) : (
            shown.map((m) => <ModuleCard key={m.module} module={m.module} pending={m.pending} categories={m.categories} generatedAt={data.generatedAt} />)
          )}
        </div>

        <OldestPending docs={data.oldestPending} generatedAt={data.generatedAt} />
      </div>
    </div>
  );
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

const TONES = {
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  success: "bg-success/10 text-success",
  accent: "bg-accent-soft text-accent-strong dark:text-accent",
  neutral: "bg-control text-ink-muted",
} as const;

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: keyof typeof TONES }) {
  return (
    <Card className="flex items-start gap-3 p-3 sm:p-4">
      <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4", TONES[tone])}>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="text-xl font-bold tracking-tight text-ink tabular-nums sm:text-2xl">{value}</span>
        <span className="truncate text-[11px] text-ink-faint">{hint}</span>
      </div>
    </Card>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:outline-none",
        active ? "border-accent-line bg-accent-soft text-accent-strong dark:text-accent" : "border-line bg-surface text-ink-muted hover:bg-control hover:text-ink",
      )}
    >
      {label}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums",
          count > 0 ? (active ? "bg-accent-strong text-white" : "bg-warning/10 text-warning") : "bg-control text-ink-faint",
        )}
      >
        {nf.format(count)}
      </span>
    </button>
  );
}

// ─── Module card with its categories ─────────────────────────────────────────

function ModuleCard({ module, pending, categories, generatedAt }: { module: string; pending: number; categories: ApprovalCategory[]; generatedAt: string }) {
  const Icon = MODULE_ICON[module] ?? Layers;
  const headingId = `module-${module.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <Card>
      <section aria-labelledby={headingId}>
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md border border-line bg-canvas text-ink-muted [&_svg]:size-3.5">
            <Icon />
          </span>
          <h2 id={headingId} className="flex-1 text-sm font-semibold text-ink sm:text-base">
            {module}
          </h2>
          <span className={cn("text-xs font-medium tabular-nums", pending > 0 ? "text-warning" : "text-ink-faint")}>{pending > 0 ? `${nf.format(pending)} pending` : "All clear"}</span>
        </header>

        {/* Column heads (wide screens); rows stack on small screens. */}
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_repeat(3,4.5rem)_6rem_2rem] gap-3 border-b border-line bg-canvas px-4 py-2 text-[11px] font-semibold tracking-wide text-ink-faint uppercase md:grid">
          <span>Category</span>
          <span>Approval layers</span>
          <span className="text-right">Pending</span>
          <span className="text-right">Approved</span>
          <span className="text-right">Rejected</span>
          <span className="text-right">Waiting</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} generatedAt={generatedAt} />
          ))}
        </ul>
      </section>
    </Card>
  );
}

function CategoryRow({ category: c, generatedAt }: { category: ApprovalCategory; generatedAt: string }) {
  const days = c.oldestPendingAt ? daysBetween(c.oldestPendingAt, generatedAt) : null;
  const total = c.pending + c.approved + c.rejected;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_repeat(3,4.5rem)_6rem_2rem] md:items-center">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-sm font-semibold text-ink">{c.label}</span>
        {total > 0 ? <Distribution pending={c.pending} approved={c.approved} rejected={c.rejected} /> : <span className="text-[11px] text-ink-faint">No documents yet</span>}
      </div>

      <Link
        href={c.href}
        aria-label={`Open ${c.label}`}
        title={`Open ${c.label}`}
        className="col-start-2 row-start-1 flex size-8 items-center justify-center self-start rounded-md text-ink-faint transition-colors hover:bg-control hover:text-ink focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:outline-none md:col-start-7 md:self-center"
      >
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>

      <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
        <ApprovalLayers category={c} />
      </div>

      <dl className="col-span-2 grid grid-cols-4 gap-2 md:contents">
        <Figure label="Pending" value={c.pending} className={c.pending > 0 ? "text-warning" : "text-ink-faint"} />
        <Figure label="Approved" value={c.approved} className={c.approved > 0 ? "text-ink" : "text-ink-faint"} />
        <Figure label="Rejected" value={c.rejected} className={c.rejected > 0 ? "text-danger" : "text-ink-faint"} />
        <div className="flex flex-col md:items-end">
          <dt className="text-[11px] font-medium text-ink-faint md:sr-only">Waiting</dt>
          <dd className={cn("text-xs font-medium tabular-nums", days === null ? "text-ink-faint" : ageTone(days))}>{days === null ? "—" : ageLabel(days)}</dd>
        </div>
      </dl>
    </li>
  );
}

function Figure({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex flex-col md:items-end">
      <dt className="text-[11px] font-medium text-ink-faint md:sr-only">{label}</dt>
      <dd className={cn("text-sm font-semibold tabular-nums", className)}>{nf.format(value)}</dd>
    </div>
  );
}

/** Pending / approved / rejected share of all the category's documents. */
function Distribution({ pending, approved, rejected }: { pending: number; approved: number; rejected: number }) {
  const total = pending + approved + rejected;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <span
      role="img"
      aria-label={`${pending} pending, ${approved} approved, ${rejected} rejected`}
      className="flex h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-control"
    >
      <span className="bg-warning" style={{ width: pct(pending) }} />
      <span className="bg-success" style={{ width: pct(approved) }} />
      <span className="bg-danger" style={{ width: pct(rejected) }} />
    </span>
  );
}

/** The approval layers of a category: its pipeline stages, and where pending documents sit. */
function ApprovalLayers({ category: c }: { category: ApprovalCategory }) {
  if (!c.pipelineConfigurable) {
    return <span className="text-xs text-ink-faint">Single layer · page approver</span>;
  }
  if (!c.pipeline) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-faint" />
        No pipeline set up
      </span>
    );
  }
  const { stages, hasSuperApprover, name } = c.pipeline;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-w-0 items-center gap-2" title={name}>
        <span aria-hidden="true" className="flex items-center">
          {Array.from({ length: Math.min(stages, 6) }, (_, i) => (
            <span key={i} className="flex items-center">
              {i > 0 && <span className="h-px w-2 bg-accent-line" />}
              <span className="flex size-4 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-[9px] font-bold text-accent-strong dark:text-accent">{i + 1}</span>
            </span>
          ))}
        </span>
        <span className="truncate text-xs font-medium text-ink">
          {stages === 0 ? "No stages" : `${stages} ${stages === 1 ? "stage" : "stages"}`}
          {hasSuperApprover && <span className="text-ink-faint"> · super approver</span>}
        </span>
      </span>
      {c.stageLoad && c.stageLoad.length > 0 && (
        <ul aria-label="Pending by stage" className="flex flex-wrap gap-1">
          {c.stageLoad.map((s) => (
            <li key={s.stageNo} className="inline-flex items-center gap-1 rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold text-warning">
              <span className="max-w-32 truncate">
                S{s.stageNo} {s.name}
              </span>
              <span className="tabular-nums">· {nf.format(s.pending)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Oldest pending documents ────────────────────────────────────────────────

function OldestPending({ docs, generatedAt }: { docs: PendingDocument[]; generatedAt: string }) {
  return (
    <Card className="h-fit xl:sticky xl:top-32">
      <section aria-labelledby="oldest-pending">
        <header className="border-b border-line px-4 py-3">
          <h2 id="oldest-pending" className="text-sm font-semibold text-ink sm:text-base">
            Waiting longest
          </h2>
          <p className="text-xs text-ink-faint">Oldest documents still pending approval</p>
        </header>
        {docs.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <CheckCircle2 aria-hidden="true" className="size-5 text-success" />
            <p className="text-xs text-ink-muted">No document is pending approval.</p>
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {docs.map((doc) => {
              const days = daysBetween(doc.createdAt, generatedAt);
              return (
                <li key={`${doc.categoryId}:${doc.id}`}>
                  <Link href={doc.href} className="flex min-h-11 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-control focus-visible:bg-control focus-visible:outline-none">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-mono text-xs font-semibold text-ink">{doc.reference}</span>
                      <span className="truncate text-[11px] text-ink-faint">
                        {doc.module} · {doc.category}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-xs font-medium tabular-nums", ageTone(days))}>{ageLabel(days)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        <p className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[11px] text-ink-faint">
          <XCircle aria-hidden="true" className="size-3" />
          Cancelled documents are not counted.
        </p>
      </section>
    </Card>
  );
}
