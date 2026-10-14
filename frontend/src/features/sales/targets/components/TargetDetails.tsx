"use client";

import { ArrowLeft, Pencil, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CONTROL } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { formatDay } from "../../lib/use-today";
import { paths } from "../../paths";
import { BUDGET_BASIS_LABELS, COMMISSION_BASIS_LABELS, MONTH_NAMES, PLAN_BASIS_LABELS, TARGET_TYPE_LABELS, type BudgetDetail, type BudgetPerson } from "../schemas/target.schema";
import { deleteAssignment, fetchBudget, fetchCommission, fetchPlan, saveBudgetPerson } from "../services/target.api";

const TH = "px-2 py-1.5 font-medium";

// ─── Sales Target Details (budget) ───────────────────────────────────────────

const CELL = "border border-line px-2 py-1";
const HEAD = "border border-line bg-accent-soft px-2 py-1.5 text-xs font-semibold text-ink";

/** Monthly targets per sales force. View shows the amounts; edit lets each sales force be saved or removed. */
export function BudgetDetailsDialog({ id, editable, onClose }: { id: string; editable: boolean; onClose: () => void }) {
  const budget = useResource(`budget:${id}`, () => fetchBudget(id));
  const [month, setMonth] = useState("");
  const data = budget.data;
  const shown = data?.persons.filter((person) => !month || person.months.some((row) => row.month === Number(month))) ?? [];
  return (
    <Dialog
      open
      size="xl"
      title="Sales Target Details"
      onClose={onClose}
      footer={
        <>
          {editable && data && (
            <Link href={paths.editBudget(data.id)} className={buttonClasses("secondary")}>
              <UserPlus aria-hidden="true" />
              Add Employee
            </Link>
          )}
          <Button variant="ghost" className="text-danger" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {budget.error ? (
        <ErrorState message={errorMessage(budget.error)} onRetry={budget.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
              <span>
                Target Type : <span className="font-semibold text-ink">{TARGET_TYPE_LABELS[data.targetType]}</span>
              </span>
              <span>
                Target Based On : <span className="font-semibold text-ink">{BUDGET_BASIS_LABELS[data.basis]}</span>
              </span>
              <span>
                Year : <span className="font-semibold text-ink">{data.year}</span>
              </span>
              <span>
                Total Target {data.basis === "QUANTITY" ? "Quantity" : "Amount"} :{" "}
                <span className="font-semibold text-ink tabular-nums">{data.basis === "QUANTITY" ? formatQty(data.total) : formatAmount(data.total)}</span>
              </span>
            </p>
            <label className="w-60">
              <span className="sr-only">Filter by month</span>
              <select value={month} onChange={(event) => setMonth(event.target.value)} className={cn(CONTROL, "h-7 w-full")}>
                <option value="">Filter By Month</option>
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {shown.length === 0 ? (
            <EmptyState title={month ? `No targets in ${MONTH_NAMES[Number(month) - 1]}` : "No sales force on this target"} />
          ) : (
            shown.map((person) => (
              <PersonMonths
                key={`${person.salesPersonId}:${data.updatedAt}`}
                budget={data}
                person={person}
                month={month ? Number(month) : null}
                editable={editable}
                onSaved={(next) => budget.mutate(() => next)}
              />
            ))
          )}
        </div>
      )}
    </Dialog>
  );
}

/** One sales force's months; in edit mode with Save and Delete. */
function PersonMonths({
  budget,
  person,
  month,
  editable,
  onSaved,
}: {
  budget: BudgetDetail;
  person: BudgetPerson;
  month: number | null;
  editable: boolean;
  onSaved: (next: BudgetDetail) => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(person.months.map((row) => [row.month, String(row.value)])));
  const [busy, setBusy] = useState(false);
  const quantity = budget.basis === "QUANTITY";
  const format = quantity ? formatQty : formatAmount;
  const shown = person.months.filter((row) => month === null || row.month === month);
  const total = shown.reduce((sum, row) => sum + (editable ? Number(values[row.month]) || 0 : row.value), 0);

  async function save(remove: boolean) {
    setBusy(true);
    try {
      const months = remove ? [] : person.months.map((row) => ({ month: row.month, value: Number(values[row.month]) || 0 }));
      onSaved(await saveBudgetPerson(budget.id, person.salesPersonId, months));
      toast.success(remove ? `${person.name} removed from the target.` : `Targets of ${person.name} saved.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          Employee Name : {person.designation ? `${person.designation}-` : ""}
          {person.name}
        </h3>
        {editable && (
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label={`Remove ${person.name}`} title="Remove from target" disabled={busy} onClick={() => save(true)}>
              <Trash2 />
            </Button>
            <Button size="sm" variant="primary" loading={busy} onClick={() => save(false)}>
              Save
            </Button>
          </span>
        )}
      </header>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={cn(HEAD, "w-28 text-left")}>SL</th>
            <th scope="col" className={cn(HEAD, "text-left")}>Month Name</th>
            <th scope="col" className={cn(HEAD, "text-right")}>{quantity ? "Quantity" : "Amount"}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={row.month}>
              <td className={cn(CELL, "text-ink")}>{index + 1}</td>
              <td className={cn(CELL, "text-ink")}>{MONTH_NAMES[row.month - 1]}</td>
              <td className={cn(CELL, "text-right tabular-nums text-ink")}>
                {editable ? (
                  <input
                    aria-label={`${person.name} ${MONTH_NAMES[row.month - 1]} target`}
                    type="number"
                    min={0}
                    step="any"
                    value={values[row.month] ?? ""}
                    onChange={(event) => setValues({ ...values, [row.month]: event.target.value })}
                    className={cn(CONTROL, "h-6 w-32 text-right tabular-nums")}
                  />
                ) : (
                  format(row.value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold text-ink">
            <td colSpan={2} className={cn(CELL, "text-right")}>
              Total :
            </td>
            <td className={cn(CELL, "text-right tabular-nums")}>{format(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

// ─── Commission view ─────────────────────────────────────────────────────────

export function CommissionDetailsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const commission = useResource(`commission:${id}`, () => fetchCommission(id));
  const data = commission.data;
  return (
    <Dialog
      open
      size="lg"
      title={data ? data.name : "Commission"}
      description={data ? `${data.salesPersonName} · ${data.customerGroupName ?? "All customers"} · ${formatDay(data.fromDate)} – ${formatDay(data.toDate)}` : undefined}
      onClose={onClose}
      footer={
        <>
          {data && (
            <Link href={paths.editCommission(data.id)} className={buttonClasses("secondary")}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {commission.error ? (
        <ErrorState message={errorMessage(commission.error)} onRetry={commission.reload} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs text-ink-muted">
            <tr className="border-b border-line">
              {["SL", "Item Name", "UOM", "Amount/Percentage Wise", "Commission"].map((label, index) => (
                <th key={label} scope="col" className={cn(TH, index === 4 ? "text-right" : "text-left")}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.lines.map((line, index) => (
              <tr key={line.itemId}>
                <td className="px-2 py-1.5 text-ink-faint">{index + 1}</td>
                <td className="px-2 py-1.5 text-ink">
                  {line.itemName} <span className="text-ink-faint">({line.itemCode})</span>
                </td>
                <td className="px-2 py-1.5">{line.uom}</td>
                <td className="px-2 py-1.5">{COMMISSION_BASIS_LABELS[line.basis]}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{line.basis === "PERCENT" ? `${line.value}%` : `${formatAmount(line.value)} / ${line.uom}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}

// ─── Sales Target (plan) detail ──────────────────────────────────────────────

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">: {value || "N/A"}</dd>
    </div>
  );
}

export function PlanDetailView({ id }: { id: string }) {
  const toast = useToast();
  const plan = useResource(`plan:${id}`, () => fetchPlan(id));
  const [busy, setBusy] = useState<string | null>(null);
  const back = (
    <Link href={paths.targetTab("sales-target")} aria-label="Back" className={buttonClasses("ghost", "icon")}>
      <ArrowLeft />
    </Link>
  );
  if (plan.error || !plan.data) {
    return (
      <PageContainer>
        <PageHead title={<span className="flex items-center gap-2">{back}Sales Target</span>} />
        {plan.error ? (
          <Card>
            <ErrorState message={errorMessage(plan.error)} onRetry={plan.reload} />
          </Card>
        ) : (
          <LoadingState />
        )}
      </PageContainer>
    );
  }
  const data = plan.data;
  const quantity = data.basis === "QUANTITY";

  async function unassign(assignmentId: string, name: string) {
    setBusy(assignmentId);
    try {
      await deleteAssignment(assignmentId);
      toast.success(`${name} removed from ${data.name}.`);
      plan.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            {back}
            {data.name}
          </span>
        }
        subtitle={`${data.number} · ${data.officeName} · ${formatDay(data.startDate)} – ${formatDay(data.endDate)}`}
        actions={
          <>
            <Link href={paths.editPlan(data.id)} className={buttonClasses("secondary")}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
            <Link href={paths.assignPlan(data.id)} className={buttonClasses("primary")}>
              <UserPlus aria-hidden="true" />
              Assign Sales Force
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
            <dl className="flex flex-col gap-1">
              <Detail label="Target Name" value={data.name} />
              <Detail label="Target Type" value={PLAN_BASIS_LABELS[data.basis]} />
              <Detail label="Sales Target" value={quantity ? `${formatQty(data.targetAmount)} units` : formatAmount(data.targetAmount)} />
              <Detail label="Remarks" value={data.remarks} />
            </dl>
            <dl className="flex flex-col gap-1">
              <Detail label="Create Date" value={formatDay(data.createDate)} />
              <Detail label="Period" value={`${formatDay(data.startDate)} – ${formatDay(data.endDate)}`} />
              <Detail label="Office" value={data.officeName} />
              <Detail label="Created By" value={data.createdBy} />
            </dl>
          </div>
        </Card>

        <Card>
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">{data.customerGroupWise ? "Customer Groups" : "Customer Lists"}</h2>
          {data.lines.length === 0 ? (
            <EmptyState title="All customers count towards this target" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-canvas text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    {["SL", data.customerGroupWise ? "Customer Group" : "Customer", "Item", "Rate", "Quantity", "Amount"].map((label, index) => (
                      <th key={label} scope="col" className={cn(TH, index >= 3 ? "text-right" : "text-left")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.lines.map((line) => (
                    <tr key={line.lineNo}>
                      <td className="px-2 py-1.5 text-ink-faint">{line.lineNo}</td>
                      <td className="px-2 py-1.5 text-ink">{line.customerName ?? line.customerGroupName}</td>
                      <td className="px-2 py-1.5">{line.itemName ?? "All items"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{line.rate === null ? "—" : formatAmount(line.rate)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{line.qty === null ? "—" : formatQty(line.qty)}</td>
                      <td className="px-2 py-1.5 text-right font-medium text-ink tabular-nums">{formatAmount(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">Assigned Sales Force</h2>
          {data.assignments.length === 0 ? (
            <EmptyState title="Nobody is assigned yet">
              <Link href={paths.assignPlan(data.id)} className="text-ink underline underline-offset-2">
                Assign the sales force
              </Link>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-canvas text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    {["SL", "Employee", "Customer Group", "Target", "Commission", "Min. Collection", ""].map((label, index) => (
                      <th key={label || index} scope="col" className={cn(TH, index >= 3 && index <= 5 ? "text-right" : "text-left")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.assignments.map((row, index) => (
                    <tr key={row.id}>
                      <td className="px-2 py-1.5 text-ink-faint">{index + 1}</td>
                      <td className="px-2 py-1.5 text-ink">
                        {row.salesPersonName}
                        {row.designation && <span className="text-ink-faint"> · {row.designation}</span>}
                      </td>
                      <td className="px-2 py-1.5">{row.customerGroupName ?? "All"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{quantity ? formatQty(row.targetAmount) : formatAmount(row.targetAmount)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{row.commissionBasis === "PERCENT" ? `${row.commissionRate}%` : formatAmount(row.commissionRate)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatAmount(row.minimumCollection)}</td>
                      <td className="px-2 py-1 text-right">
                        <Button variant="ghost" size="icon" aria-label={`Remove ${row.salesPersonName}`} title="Remove" disabled={busy === row.id} onClick={() => unassign(row.id, row.salesPersonName)}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
