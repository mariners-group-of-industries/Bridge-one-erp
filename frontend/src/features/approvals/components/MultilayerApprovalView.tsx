"use client";

import { CheckCircle2, Layers, RefreshCw, Settings2 } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
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
import { ApprovalQueueDialog } from "./ApprovalQueueDialog";
import type { ApprovalCategory, ApprovalSummary } from "../types";

const APPROVAL_SETUP = "/configuration/security/approval-setup";
const MODULE_ORDER = [
  "Purchase",
  "Sales",
  "Inventory",
  "Production",
  "Accounts",
  "HR & Payroll",
  "RTM",
];
const MODULE_ICON: Record<string, (typeof purchaseWorkspace)["icon"]> = {
  Purchase: purchaseWorkspace.icon,
  Sales: salesWorkspace.icon,
  Inventory: inventoryWorkspace.icon,
  Production: productionWorkspace.icon,
  Accounts: accountWorkspace.icon,
  "HR & Payroll": hrmWorkspace.icon,
  RTM: rtmWorkspace.icon,
};

const nf = new Intl.NumberFormat("en-US");

export function MultilayerApprovalView() {
  const summary = useResource("approval-summary", fetchApprovalSummary, {
    refreshOnFocus: true,
  });
  const { can } = useSession();

  return (
    <PageContainer full>
      <PageHead
        title="Multilayer Approval"
        subtitle="Open a category to approve or reject what is waiting in it, right here."
        actions={
          <>
            {can(APPROVAL_SETUP) && (
              <Link
                href={APPROVAL_SETUP}
                className={buttonClasses("secondary", "md", "min-h-8")}
              >
                <Settings2 aria-hidden="true" />
                Approval Setup
              </Link>
            )}
            <Button
              variant="primary"
              onClick={summary.reload}
              loading={summary.loading && !!summary.data}
            >
              {!(summary.loading && summary.data) && (
                <RefreshCw aria-hidden="true" />
              )}
              Refresh
            </Button>
          </>
        }
      />
      {summary.error && !summary.data ? (
        <Card>
          <ErrorState
            message={errorMessage(summary.error)}
            onRetry={summary.reload}
          />
        </Card>
      ) : !summary.data ? (
        <Card>
          <LoadingState label="Loading approvals…" />
        </Card>
      ) : (
        <PendingBoard data={summary.data} refreshing={summary.loading} onDecided={summary.reload} />
      )}
    </PageContainer>
  );
}

/** Pending approvals as tiles, one group per module; each tile opens the page where its documents are approved. */
function PendingBoard({
  data,
  refreshing,
  onDecided,
}: {
  data: ApprovalSummary;
  refreshing: boolean;
  onDecided: () => void;
}) {
  const [pendingOnly, setPendingOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const openCategory = data.categories.find((c) => c.id === openId) ?? null;
  const switchId = useId();

  const modules = useMemo(() => {
    const byModule = new Map<string, ApprovalCategory[]>();
    for (const c of data.categories)
      byModule.set(c.module, [...(byModule.get(c.module) ?? []), c]);
    return [
      ...MODULE_ORDER.filter((m) => byModule.has(m)),
      ...[...byModule.keys()].filter((m) => !MODULE_ORDER.includes(m)),
    ].map((module) => ({
      module,
      categories: byModule.get(module) ?? [],
    }));
  }, [data.categories]);

  const totalPending = data.categories.reduce((sum, c) => sum + c.pending, 0);
  const shown = modules
    .map((m) => ({
      ...m,
      categories: pendingOnly
        ? m.categories.filter((c) => c.pending > 0)
        : m.categories,
    }))
    .filter((m) => m.categories.length > 0);

  return (
    <section aria-busy={refreshing} aria-label="Pending approvals">
      <Card className={cn("transition-opacity", refreshing && "opacity-70")}>
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="flex-1 text-base font-semibold text-ink sm:text-lg">
            Pending Approvals
            <span className="ml-2 text-sm font-medium text-ink-muted tabular-nums">
              ({nf.format(totalPending)})
            </span>
          </h2>
          <label
            htmlFor={switchId}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs font-medium text-ink-muted select-none sm:min-h-8"
          >
            Pending only
            <span className="relative inline-flex">
              <input
                id={switchId}
                type="checkbox"
                role="switch"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="h-4 w-8 rounded-full bg-line-strong transition-colors peer-checked:bg-primary/40 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30"
              />
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-0 size-5 -translate-y-1/2 rounded-full border border-line bg-surface shadow-xs transition-transform peer-checked:translate-x-3.5 peer-checked:border-primary peer-checked:bg-primary"
              />
            </span>
          </label>
        </header>

        {data.categories.length === 0 ? (
          <Empty
            icon={
              <Layers aria-hidden="true" className="size-6 text-ink-faint" />
            }
            title="No approval categories to show"
            text="You don't have access to any page where documents are approved. Ask an administrator for access."
          />
        ) : shown.length === 0 ? (
          <Empty
            icon={
              <CheckCircle2
                aria-hidden="true"
                className="size-6 text-success"
              />
            }
            title="Nothing is waiting"
            text="No document is pending approval."
          />
        ) : (
          <div className="flex flex-col gap-5 px-4 py-4">
            {shown.map((m) => (
              <ModuleGroup
                key={m.module}
                module={m.module}
                categories={m.categories}
                onOpen={setOpenId}
              />
            ))}
          </div>
        )}
      </Card>
      <ApprovalQueueDialog
        category={openCategory}
        onClose={() => setOpenId(null)}
        onDecided={onDecided}
      />
    </section>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      {icon}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-xs text-ink-muted">{text}</p>
    </div>
  );
}

function ModuleGroup({
  module,
  categories,
  onOpen,
}: {
  module: string;
  categories: ApprovalCategory[];
  onOpen: (id: string) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3
        id={headingId}
        className="text-xs font-bold tracking-wide text-ink uppercase"
      >
        {module}
      </h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(15rem,16rem))]">
        {categories.map((c) => (
          <li key={c.id}>
            <CategoryTile category={c} onOpen={() => onOpen(c.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One category: its name on the left, pending count in a red block on the right. Opens its queue on this page. */
function CategoryTile({
  category: c,
  onOpen,
}: {
  category: ApprovalCategory;
  onOpen: () => void;
}) {
  const Icon = MODULE_ICON[c.module] ?? Layers;
  const layers = !c.pipelineConfigurable
    ? "single layer"
    : c.pipeline
      ? `${c.pipeline.stages}-stage pipeline`
      : "no pipeline set up";
  const detail = `${nf.format(c.pending)} pending · ${nf.format(c.approved)} approved · ${nf.format(c.rejected)} rejected · ${layers}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={detail}
      aria-label={`${c.label}: ${detail}`}
      aria-haspopup="dialog"
      className="group flex min-h-11 w-full items-stretch text-left overflow-hidden rounded-md border border-accent-line/70 bg-accent-soft/60 shadow-2xs transition-[box-shadow,border-color] hover:border-accent-line hover:shadow-xs focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
    >
      <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center text-ink-muted [&_svg]:size-5"
        >
          <Icon />
        </span>
        <span className="line-clamp-2 text-xs font-medium text-ink group-hover:text-accent-strong">
          {c.label}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex w-11 shrink-0 items-center justify-center text-xs font-semibold tabular-nums",
          c.pending > 0
            ? "bg-danger/80 text-white"
            : "bg-control text-ink-faint",
        )}
      >
        {nf.format(c.pending)}
      </span>
    </button>
  );
}
