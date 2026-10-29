import { TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Card, EmptyState } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty, percentOf } from "../lib/format";
import type { RankedEntry, SalesDashboard } from "../schemas/dashboard.schema";

/** Card with a title row; the dashboard's building block. */
export function Widget({ title, subtitle, className, children }: { title: string; subtitle?: string; className?: string; children: ReactNode }) {
  const id = `widget-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Card className={cn("flex flex-col", className)}>
      <section aria-labelledby={id} className="flex flex-1 flex-col gap-3 p-4">
        <header className="flex flex-col gap-0.5">
          <h2 id={id} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-ink-faint">{subtitle}</p>}
        </header>
        {children}
      </section>
    </Card>
  );
}

/** Headline number with a chart icon (Total Sales, Total Collection …), as its own card. */
export function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line p-4 shadow-sm" title={hint}>
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <TrendingUp className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xl font-bold text-ink tabular-nums">{formatAmount(value)}</span>
        <span className="text-xs font-medium text-ink-muted">{label}</span>
      </span>
    </div>
  );
}

/** Avatar tints of the Top 10 lists, in turn: blue, green, red. */
const AVATAR_TINTS = ["bg-accent-soft text-accent-strong", "bg-success/10 text-success", "bg-danger/10 text-danger"];

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Achieved share of the target as a ring: accent arc on a lighter track of the same hue. */
export function TargetWidget({ data }: { data: SalesDashboard["target"] }) {
  const percent = percentOf(data.achieved, data.target);
  const share = percent === null ? 0 : Math.min(percent, 100) / 100;
  const remaining = Math.max(0, data.target - data.achieved);
  return (
    <Widget title="Sales Target/Achieved">
      {percent === null ? (
        <EmptyState title="No targets set">Add monthly targets in Sales Target to track progress here.</EmptyState>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <figure className="relative">
            <svg
              viewBox="0 0 180 180"
              className="size-52"
              role="img"
              aria-label={`${percent}% of the target achieved: ${formatAmount(data.achieved)} of ${formatAmount(data.target)}`}
            >
              <circle cx="90" cy="90" r={RADIUS} fill="none" strokeWidth="26" className="stroke-accent-soft">
                <title>{`Remaining: ${formatAmount(remaining)}`}</title>
              </circle>
              {share > 0 && (
                <circle
                  cx="90"
                  cy="90"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="26"
                  strokeLinecap={share < 1 ? "round" : "butt"}
                  strokeDasharray={`${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  transform="rotate(-90 90 90)"
                  className="stroke-accent"
                >
                  <title>{`Achieved: ${formatAmount(data.achieved)}`}</title>
                </circle>
              )}
            </svg>
            <figcaption className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-ink tabular-nums">{percent}%</span>
              <span className="text-xs text-ink-faint">achieved</span>
            </figcaption>
          </figure>
          <dl className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />
              <dt className="text-ink-muted">Achieved</dt>
              <dd className="font-medium text-ink tabular-nums">{formatAmount(data.achieved)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-accent-soft ring-1 ring-accent-line" />
              <dt className="text-ink-muted">Target</dt>
              <dd className="font-medium text-ink tabular-nums">{formatAmount(data.target)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Widget>
  );
}

const CELL = "border border-line px-2 py-1.5";
const NUM = "text-right tabular-nums";

/** Overdue (with due) and today's overdue side by side, as one table. */
export function OverdueWidget({ data, className }: { data: SalesDashboard; className?: string }) {
  const rows = Math.max(data.overdue.length, data.dueToday.length);
  return (
    <Widget title="Overdue/Due" className={className}>
      {rows === 0 ? (
        <EmptyState title="No overdue or due customers" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Customer balances as of {data.to}. Collections and returns settle the oldest dues first.</caption>
            <thead className="bg-canvas text-xs text-ink">
              <tr>
                <th scope="colgroup" colSpan={3} className={cn(CELL, "text-center font-semibold")}>
                  Overdue
                </th>
                <th scope="colgroup" colSpan={2} className={cn(CELL, "text-center font-semibold")}>
                  Today&apos;s Overdue
                </th>
              </tr>
              <tr>
                <th scope="col" className={cn(CELL, "text-left font-semibold")}>Customer Name</th>
                <th scope="col" className={cn(CELL, NUM, "font-semibold")}>OD Amount</th>
                <th scope="col" className={cn(CELL, NUM, "font-semibold")}>Due</th>
                <th scope="col" className={cn(CELL, "text-left font-semibold")}>Customer Name</th>
                <th scope="col" className={cn(CELL, NUM, "font-semibold")}>OD Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, index) => {
                const overdue = data.overdue[index];
                const today = data.dueToday[index];
                return (
                  <tr key={index}>
                    <td className={cn(CELL, "text-ink")}>{overdue?.name}</td>
                    <td className={cn(CELL, NUM, "text-ink")}>{overdue && formatAmount(overdue.overdue)}</td>
                    <td className={cn(CELL, NUM, "text-ink-muted")}>{overdue && formatAmount(overdue.due)}</td>
                    <td className={cn(CELL, "text-ink")}>{today?.name}</td>
                    <td className={cn(CELL, NUM, "text-ink")}>{today && formatAmount(today.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Widget>
  );
}

/** Top 10 list as a two-column grid of tiles: initial, name, quantity and amount. */
export function RankedWidget({ title, rows, empty, className }: { title: string; rows: RankedEntry[]; empty: string; className?: string }) {
  return (
    <Widget title={title} className={className}>
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {rows.map((row, index) => (
            <li
              key={row.id}
              title={`${index + 1}. ${row.name}${row.detail ? ` (${row.detail})` : ""}: ${formatAmount(row.amount)} · ${formatQty(row.qty)} Qty`}
              className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2"
            >
              <span
                aria-hidden="true"
                className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", AVATAR_TINTS[index % AVATAR_TINTS.length])}
              >
                {row.name.replace(/^(M\/S|Md\.|Mst\.)\s*/i, "").charAt(0).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-ink">{row.name}</span>
                <span className="text-xs text-ink-faint tabular-nums">{formatQty(row.qty)} Qty</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-success tabular-nums">{formatAmount(row.amount)}</span>
            </li>
          ))}
        </ol>
      )}
    </Widget>
  );
}
