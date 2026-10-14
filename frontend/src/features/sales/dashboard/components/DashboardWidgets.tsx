import type { ReactNode } from "react";
import { Card, EmptyState } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty, percentOf } from "../lib/format";
import type { DueTodayRow, OverdueRow, RankedEntry, SalesDashboard } from "../schemas/dashboard.schema";

/** Card with a title row; the dashboard's building block. */
export function Widget({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = `widget-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Card className={cn("flex flex-col", className)}>
      <section aria-labelledby={id} className="flex flex-1 flex-col gap-3 p-4">
        <header className="flex flex-col gap-0.5 border-b border-line pb-2">
          <h2 id={id} className="text-xs font-bold tracking-wide text-ink uppercase">
            {title}
          </h2>
          {subtitle && <p className="text-[11px] text-ink-faint">{subtitle}</p>}
        </header>
        {children}
      </section>
    </Card>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1.5 border-l-4 border-l-accent p-3.5 transition-shadow hover:shadow-sm">
      <p className="truncate text-[11px] font-semibold tracking-wider text-ink-faint uppercase">{label}</p>
      <p className="text-xl font-bold tracking-tight text-ink tabular-nums">{formatAmount(value)}</p>
      {hint && <p className="truncate text-[11px] text-ink-faint">{hint}</p>}
    </Card>
  );
}

/** Achieved-vs-target bar: accent fill on a lighter track of the same hue. */
function Meter({ achieved, target, label }: { achieved: number; target: number; label: string }) {
  const percent = percentOf(achieved, target) ?? 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(achieved, target)}
      aria-valuetext={`${percent}% (${formatAmount(achieved)} of ${formatAmount(target)})`}
      title={`${formatAmount(achieved)} of ${formatAmount(target)}`}
      className="h-2 w-full overflow-hidden rounded-full bg-accent/15"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

export function TargetWidget({ data }: { data: SalesDashboard["target"] }) {
  const percent = percentOf(data.achieved, data.target);
  return (
    <Widget title="Sales Target / Achieved" subtitle="Targets of every month in the selected range.">
      {percent === null ? (
        <EmptyState title="No targets set">Add monthly targets in Sales Target to track progress here.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-semibold text-ink">{percent}%</span>
              <span className="text-xs text-ink-faint">achieved</span>
            </div>
            <Meter achieved={data.achieved} target={data.target} label="Overall target achieved" />
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Achieved</dt>
                <dd className="font-medium text-ink tabular-nums">{formatAmount(data.achieved)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-ink-faint">Target</dt>
                <dd className="font-medium text-ink tabular-nums">{formatAmount(data.target)}</dd>
              </div>
            </dl>
          </div>
          <ul className="flex flex-col gap-3 border-t border-line pt-3">
            {data.salesPersons.map((row) => (
              <li key={row.salesPersonId} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{row.name}</span>
                  <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                    {percentOf(row.achieved, row.target)}% · {formatAmount(row.achieved)} / {formatAmount(row.target)}
                  </span>
                </div>
                <Meter achieved={row.achieved} target={row.target} label={`${row.name} target achieved`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Widget>
  );
}

const TH = "px-2 py-1.5 text-left text-xs font-medium text-ink-muted";
const TD = "px-2 py-1.5 text-sm text-ink";
const NUM = "text-right tabular-nums";

function OverdueTable({ rows }: { rows: OverdueRow[] }) {
  if (rows.length === 0) return <EmptyState title="No overdue customers" />;
  return (
    <table className="data-grid w-full">
      <thead className="border-b border-line">
        <tr>
          <th scope="col" className={TH}>Customer Name</th>
          <th scope="col" className={cn(TH, NUM)}>OD Amount</th>
          <th scope="col" className={cn(TH, NUM)}>Due</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row.customerId}>
            <td className={TD}>{row.name}</td>
            <td className={cn(TD, NUM, "font-medium text-danger")}>{formatAmount(row.overdue)}</td>
            <td className={cn(TD, NUM)}>{formatAmount(row.due)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DueTodayTable({ rows }: { rows: DueTodayRow[] }) {
  if (rows.length === 0) return <EmptyState title="Nothing falls due on this day" />;
  return (
    <table className="data-grid w-full">
      <thead className="border-b border-line">
        <tr>
          <th scope="col" className={TH}>Customer Name</th>
          <th scope="col" className={cn(TH, NUM)}>Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row.customerId}>
            <td className={TD}>{row.name}</td>
            <td className={cn(TD, NUM)}>{formatAmount(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function OverdueWidget({ data, className }: { data: SalesDashboard; className?: string }) {
  return (
    <Widget
      title="Overdue / Due"
      subtitle={`Customer balances as of ${data.to}. Collections and returns settle the oldest dues first.`}
      className={className}
    >
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="overflow-x-auto">
          <h3 className="mb-1 text-sm font-semibold text-ink">Overdue</h3>
          <OverdueTable rows={data.overdue} />
        </div>
        <div className="overflow-x-auto">
          <h3 className="mb-1 text-sm font-semibold text-ink">Today&apos;s Overdue</h3>
          <DueTodayTable rows={data.dueToday} />
        </div>
      </div>
    </Widget>
  );
}

/** Ranked list with a single-hue bar scaled to the top entry. */
export function RankedWidget({ title, rows, empty }: { title: string; rows: RankedEntry[]; empty: string }) {
  const max = rows[0]?.amount ?? 0;
  return (
    <Widget title={title} subtitle="Net of returns, in the selected range.">
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ol className="flex flex-col gap-2.5">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-start gap-3" title={`${row.name}: ${formatAmount(row.amount)}`}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-control text-xs font-medium text-ink-muted">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{row.name}</span>
                  <span className="shrink-0 text-sm font-medium text-ink tabular-nums">{formatAmount(row.amount)}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-accent/15">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${max > 0 ? (row.amount / max) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-ink-faint">
                  {row.detail ? `${row.detail} · ` : ""}
                  {formatQty(row.qty)} Qty
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Widget>
  );
}
