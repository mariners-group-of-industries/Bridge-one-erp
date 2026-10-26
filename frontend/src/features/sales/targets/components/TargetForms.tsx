"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { CONTROL, CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState, Section } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import { issuesToErrors } from "../../lib/form";
import { useToday } from "../../lib/use-today";
import { CATEGORY_LEVEL_LABELS, type ItemOption, type SalesLookups } from "../../masters/schemas/masters.schema";
import { fetchCustomers, fetchItems, fetchSalesLookups, fetchSetupLookups } from "../../masters/services/masters.api";
import { paths } from "../../paths";
import { round2 } from "../../quotations/lib/totals";
import {
  BUDGET_BASIS_LABELS,
  COMMISSION_BASES,
  COMMISSION_BASIS_LABELS,
  MONTH_NAMES,
  PLAN_BASIS_LABELS,
  TARGET_BASES,
  TARGET_TYPES,
  TARGET_TYPE_LABELS,
  assignInputSchema,
  budgetInputSchema,
  commissionInputSchema,
  planInputSchema,
  type CommissionBasis,
  type TargetBasis,
  type TargetType,
} from "../schemas/target.schema";
import {
  assignPlan,
  createBudget,
  createCommission,
  createPlan,
  fetchBudget,
  fetchCommission,
  fetchPlan,
  fetchPlans,
  updateBudget,
  updateCommission,
  updatePlan,
} from "../services/target.api";

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const newKey = () => crypto.randomUUID();
const monthOptions = MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name }));

function Frame({ title, back, subtitle, actions, children }: { title: string; back: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title={
          <span className="flex items-center gap-2">
            <Link href={back} aria-label="Back" className={buttonClasses("ghost", "icon")}>
              <ArrowLeft />
            </Link>
            {title}
          </span>
        }
        subtitle={subtitle}
        actions={actions}
      />
      {children}
    </PageContainer>
  );
}

function Waiting({ title, back, error, onRetry }: { title: string; back: string; error?: Error | null; onRetry?: () => void }) {
  return (
    <Frame title={title} back={back}>
      {error ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={onRetry} />
        </Card>
      ) : (
        <LoadingState />
      )}
    </Frame>
  );
}

/** Setup lists, customers and items of a business unit. */
function useUnitMasters(businessUnitId: string | null) {
  return useResource(businessUnitId && `target-masters:${businessUnitId}`, async () => {
    const [setup, customers, items] = await Promise.all([fetchSetupLookups(businessUnitId!), fetchCustomers(businessUnitId!), fetchItems(businessUnitId!, true)]);
    return { setup, customers, items };
  });
}

function useSubmit() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  function fail(next: Record<string, string>) {
    setErrors(next);
    toast.error(Object.values(next)[0] ?? "Please correct the highlighted fields.");
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setErrors({});
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }
  return { busy, errors, fail, run, toast };
}

// ─── Target (budget) ─────────────────────────────────────────────────────────

interface PersonRow {
  salesPersonId: string;
  months: Record<number, string>;
}

export function BudgetFormView({ id }: { id?: string }) {
  const today = useToday();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const budget = useResource(id ? `budget:${id}` : null, () => fetchBudget(id!));
  const title = id ? "Edit Sales Target" : "Create Sales Target";
  const back = paths.targetTab("target");
  if (lookups.error || budget.error) return <Waiting title={title} back={back} error={lookups.error ?? budget.error} onRetry={lookups.reload} />;
  if (!today || !lookups.data || (id && !budget.data)) return <Waiting title={title} back={back} />;
  return <BudgetEditor key={budget.data?.updatedAt ?? "new"} today={today} lookups={lookups.data} existing={budget.data ?? null} />;
}

function BudgetEditor({ today, lookups, existing }: { today: string; lookups: SalesLookups; existing: Awaited<ReturnType<typeof fetchBudget>> | null }) {
  const router = useRouter();
  const { busy, errors, fail, run, toast } = useSubmit();
  const units = [...new Map(lookups.offices.map((office) => [office.businessUnitId, office.businessUnitName])).entries()];
  const [businessUnitId, setBusinessUnitId] = useState(existing?.businessUnitId ?? units[0]?.[0] ?? "");
  const [targetType, setTargetType] = useState<string>(existing?.targetType ?? "");
  const [basis, setBasis] = useState<string>(existing?.basis ?? "");
  const [year, setYear] = useState(String(existing?.year ?? today.slice(0, 4)));
  const [persons, setPersons] = useState<PersonRow[]>(() =>
    (existing?.persons ?? []).map((person) => ({ salesPersonId: person.salesPersonId, months: Object.fromEntries(person.months.map((row) => [row.month, String(row.value)])) })),
  );
  const [entry, setEntry] = useState({ salesPersonId: "", fromMonth: "1", toMonth: "12", value: "" });
  const masters = useUnitMasters(businessUnitId || null);
  const salesPersons = masters.data?.setup.salesPersons ?? [];
  const nameOf = (personId: string) => salesPersons.find((person) => person.id === personId)?.name ?? existing?.persons.find((person) => person.salesPersonId === personId)?.name ?? "Unknown";
  const quantity = basis === "QUANTITY";
  const ready = targetType && basis;

  function add() {
    if (!entry.salesPersonId) return toast.error("Select a sales force.");
    const from = Number(entry.fromMonth);
    const to = Number(entry.toMonth);
    if (from > to) return toast.error("From Month must be on or before To Month.");
    if (!(toNumber(entry.value) > 0)) return toast.error(`Enter the target ${quantity ? "quantity" : "amount"} per month.`);
    setPersons((current) => {
      const months: Record<number, string> = {};
      for (let month = from; month <= to; month++) months[month] = entry.value;
      const found = current.find((row) => row.salesPersonId === entry.salesPersonId);
      if (found) return current.map((row) => (row === found ? { ...row, months: { ...row.months, ...months } } : row));
      return [...current, { salesPersonId: entry.salesPersonId, months }];
    });
    setEntry({ ...entry, salesPersonId: "" });
  }

  function save() {
    const input = {
      businessUnitId,
      targetType: targetType as TargetType,
      basis: basis as TargetBasis,
      year: Number(year),
      persons: persons.map((person) => ({
        salesPersonId: person.salesPersonId,
        months: Object.entries(person.months)
          .filter(([, value]) => value.trim() !== "")
          .map(([month, value]) => ({ month: Number(month), value: toNumber(value) })),
      })),
    };
    const parsed = budgetInputSchema.safeParse(input);
    if (!parsed.success) return fail(issuesToErrors(parsed.error));
    void run(async () => {
      const saved = existing ? await updateBudget(existing.id, existing.updatedAt, input) : await createBudget(input);
      toast.success(`${BUDGET_BASIS_LABELS[saved.basis]} ${saved.year} saved.`);
      router.replace(paths.targetTab("target"));
    });
  }
  useSaveShortcut(save, true);

  const usedMonths = [...new Set(persons.flatMap((person) => Object.keys(person.months).map(Number)))].sort((a, b) => a - b);
  const grandTotal = persons.reduce((sum, person) => sum + Object.values(person.months).reduce((total, value) => total + toNumber(value), 0), 0);

  return (
    <Frame
      title={existing ? "Edit Sales Target" : "Create Sales Target"}
      back={paths.targetTab("target")}
      actions={
        <Button variant="primary" onClick={save} loading={busy} disabled={!ready}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Type"
                required
                value={targetType}
                error={errors.targetType}
                options={[{ value: "", label: "Type" }, ...TARGET_TYPES.map((type) => ({ value: type, label: TARGET_TYPE_LABELS[type] }))]}
                onChange={(event) => setTargetType(event.target.value)}
              />
              <SelectField
                label="Target Based On"
                required
                value={basis}
                error={errors.basis}
                options={[{ value: "", label: "Target Based On" }, ...TARGET_BASES.map((value) => ({ value, label: BUDGET_BASIS_LABELS[value] }))]}
                onChange={(event) => setBasis(event.target.value)}
              />
              {ready && (
                <>
                  <TextField label="Year" type="number" required min={2000} max={2100} value={year} error={errors.year} onChange={(event) => setYear(event.target.value)} />
                  {units.length > 1 && (
                    <SelectField
                      label="Business Unit"
                      value={businessUnitId}
                      disabled={!!existing}
                      options={units.map(([unitId, name]) => ({ value: unitId, label: name }))}
                      onChange={(event) => {
                        setBusinessUnitId(event.target.value);
                        setPersons([]);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </Section>
        </Card>

        {ready && (
          <Card>
            <Section title="Sales Force Targets" description={`Targets per month, in ${quantity ? "quantity" : "taka"}. Adding a sales force again updates those months.`}>
              <div
                className="grid items-end gap-3 rounded-lg bg-canvas p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
                    event.preventDefault();
                    add();
                  }
                }}
              >
                <SelectField
                  label="Sales Force"
                  value={entry.salesPersonId}
                  disabled={masters.loading}
                  options={[{ value: "", label: masters.loading ? "Loading…" : "Select sales force" }, ...salesPersons.map((person) => ({ value: person.id, label: `${person.name}${person.designation ? ` (${person.designation})` : ""}` }))]}
                  onChange={(event) => setEntry({ ...entry, salesPersonId: event.target.value })}
                />
                <SelectField label="From Month" options={monthOptions} value={entry.fromMonth} onChange={(event) => setEntry({ ...entry, fromMonth: event.target.value })} />
                <SelectField label="To Month" options={monthOptions} value={entry.toMonth} onChange={(event) => setEntry({ ...entry, toMonth: event.target.value })} />
                <TextField label={quantity ? "Quantity / Month" : "Amount / Month"} type="number" min={0} step="any" value={entry.value} onChange={(event) => setEntry({ ...entry, value: event.target.value })} />
                <Button onClick={add}>
                  <Plus aria-hidden="true" />
                  Add
                </Button>
              </div>
              {persons.length === 0 ? (
                <EmptyState title="No sales force added yet" />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas text-xs text-ink-muted">
                      <tr className="border-b border-line">
                        <th scope="col" className="px-2 py-2 text-left font-medium">Sales Force</th>
                        {usedMonths.map((month) => (
                          <th key={month} scope="col" className="px-2 py-2 text-right font-medium">
                            {MONTH_NAMES[month - 1].slice(0, 3)}
                          </th>
                        ))}
                        <th scope="col" className="px-2 py-2 text-right font-medium">Total</th>
                        <th scope="col" className="w-10 px-2 py-2">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {persons.map((person) => (
                        <tr key={person.salesPersonId}>
                          <td className="px-2 py-1.5 whitespace-nowrap text-ink">{nameOf(person.salesPersonId)}</td>
                          {usedMonths.map((month) => (
                            <td key={month} className="min-w-24 px-1 py-1">
                              <input
                                aria-label={`${nameOf(person.salesPersonId)} ${MONTH_NAMES[month - 1]}`}
                                type="number"
                                min={0}
                                step="any"
                                value={person.months[month] ?? ""}
                                onChange={(event) =>
                                  setPersons((current) => current.map((row) => (row === person ? { ...row, months: { ...row.months, [month]: event.target.value } } : row)))
                                }
                                className={cn(CONTROL, "h-7 w-full text-right tabular-nums")}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-right font-medium text-ink tabular-nums">
                            {(quantity ? formatQty : formatAmount)(Object.values(person.months).reduce((sum, value) => sum + toNumber(value), 0))}
                          </td>
                          <td className="px-1 py-1">
                            <Button variant="ghost" size="icon" aria-label={`Remove ${nameOf(person.salesPersonId)}`} onClick={() => setPersons((current) => current.filter((row) => row !== person))}>
                              <Trash2 />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
                      <tr>
                        <td className="px-2 py-2">Total</td>
                        {usedMonths.map((month) => (
                          <td key={month} className="px-2 py-2 text-right tabular-nums">
                            {(quantity ? formatQty : formatAmount)(persons.reduce((sum, person) => sum + toNumber(person.months[month] ?? ""), 0))}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right tabular-nums">{(quantity ? formatQty : formatAmount)(grandTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {errors.persons && <p className="text-xs text-danger">{errors.persons}</p>}
            </Section>
          </Card>
        )}
      </div>
    </Frame>
  );
}

// ─── Sales Target (plan) ─────────────────────────────────────────────────────

interface PlanLineValues {
  key: string;
  partyId: string;
  itemId: string;
  rate: string;
  qty: string;
  amount: string;
}

export function PlanFormView({ id }: { id?: string }) {
  const today = useToday();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const plan = useResource(id ? `plan:${id}` : null, () => fetchPlan(id!));
  const title = id ? "Edit Sales Target" : "Sales Target";
  const back = id ? paths.plan(id) : paths.targetTab("sales-target");
  if (lookups.error || plan.error) return <Waiting title={title} back={back} error={lookups.error ?? plan.error} onRetry={lookups.reload} />;
  if (!today || !lookups.data || (id && !plan.data)) return <Waiting title={title} back={back} />;
  return <PlanEditor key={plan.data?.updatedAt ?? "new"} today={today} lookups={lookups.data} existing={plan.data ?? null} />;
}

function PlanEditor({ today, lookups, existing }: { today: string; lookups: SalesLookups; existing: Awaited<ReturnType<typeof fetchPlan>> | null }) {
  const router = useRouter();
  const listId = useId();
  const { busy, errors, fail, run, toast } = useSubmit();
  const [header, setHeader] = useState({
    createDate: existing?.createDate ?? today,
    officeId: existing?.officeId ?? lookups.offices[0]?.id ?? "",
    basis: existing?.basis ?? "",
    name: existing?.name ?? "",
    targetAmount: existing ? String(existing.targetAmount) : "",
    startDate: existing?.startDate ?? "",
    endDate: existing?.endDate ?? "",
    remarks: existing?.remarks ?? "",
  });
  const [groupWise, setGroupWise] = useState(existing?.customerGroupWise ?? false);
  const [lines, setLines] = useState<PlanLineValues[]>(() =>
    (existing?.lines ?? []).map((line) => ({
      key: newKey(),
      partyId: line.customerId ?? line.customerGroupId ?? "",
      itemId: line.itemId ?? "",
      rate: line.rate === null ? "" : String(line.rate),
      qty: line.qty === null ? "" : String(line.qty),
      amount: String(line.amount),
    })),
  );
  const [entry, setEntry] = useState({ partyId: "", itemText: "", rate: "", qty: "", amount: "" });
  const set = <K extends keyof typeof header>(key: K, value: (typeof header)[K]) => setHeader((current) => ({ ...current, [key]: value }));

  const office = lookups.offices.find((candidate) => candidate.id === header.officeId);
  const masters = useUnitMasters(office?.businessUnitId ?? null);
  const customers = masters.data?.customers ?? [];
  const groups = masters.data?.setup.customerGroups ?? [];
  const items = useMemo(() => masters.data?.items ?? [], [masters.data]);
  const itemLabel = (item: ItemOption) => `${item.code} — ${item.name}`;
  const parties = groupWise ? groups.map((group) => ({ id: group.id, name: group.name })) : customers.map((customer) => ({ id: customer.id, name: `${customer.code} - ${customer.name}` }));
  const partyName = (partyId: string) =>
    parties.find((party) => party.id === partyId)?.name ??
    existing?.lines.find((line) => (line.customerId ?? line.customerGroupId) === partyId)?.[groupWise ? "customerGroupName" : "customerName"] ??
    "Unknown";
  const itemName = (itemId: string) => items.find((item) => item.id === itemId)?.name ?? existing?.lines.find((line) => line.itemId === itemId)?.itemName ?? "All items";
  const linesTotal = round2(lines.reduce((sum, line) => sum + toNumber(line.amount), 0));

  function pickItem(text: string) {
    const match = items.find((item) => itemLabel(item) === text);
    const rate = match ? String(match.salesRate) : entry.rate;
    setEntry({ ...entry, itemText: text, rate, amount: entry.qty && match ? String(round2(toNumber(entry.qty) * match.salesRate)) : entry.amount });
  }

  function add() {
    if (!entry.partyId) return toast.error(groupWise ? "Select a customer group." : "Select a customer.");
    const item = items.find((candidate) => itemLabel(candidate) === entry.itemText);
    if (entry.itemText && !item) return toast.error("Select the item from the list.");
    if (!(toNumber(entry.amount) > 0)) return toast.error("Enter the amount.");
    setLines([...lines, { key: newKey(), partyId: entry.partyId, itemId: item?.id ?? "", rate: entry.rate, qty: entry.qty, amount: entry.amount }]);
    setEntry({ partyId: "", itemText: "", rate: "", qty: "", amount: "" });
  }

  function save(thenAssign: boolean) {
    const input = {
      ...header,
      basis: header.basis as TargetBasis,
      targetAmount: toNumber(header.targetAmount),
      customerGroupWise: groupWise,
      lines: lines.map((line) => ({
        customerId: groupWise ? null : line.partyId,
        customerGroupId: groupWise ? line.partyId : null,
        itemId: line.itemId || null,
        rate: line.rate.trim() === "" ? null : toNumber(line.rate),
        qty: line.qty.trim() === "" ? null : toNumber(line.qty),
        amount: toNumber(line.amount),
      })),
    };
    const parsed = planInputSchema.safeParse(input);
    if (!parsed.success) return fail(issuesToErrors(parsed.error));
    void run(async () => {
      const saved = existing ? await updatePlan(existing.id, existing.updatedAt, input) : await createPlan(input);
      toast.success(`${saved.name} saved.`);
      router.replace(thenAssign ? paths.assignPlan(saved.id) : paths.plan(saved.id));
    });
  }
  useSaveShortcut(() => save(false), true);

  return (
    <Frame
      title={existing ? `Edit ${existing.name}` : "Sales Target"}
      back={existing ? paths.plan(existing.id) : paths.targetTab("sales-target")}
      actions={
        <Button variant="primary" onClick={() => save(false)} loading={busy}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-6">
              <TextField label="Create Date" type="date" required value={header.createDate} error={errors.createDate} onChange={(event) => set("createDate", event.target.value)} />
              <SelectField
                label="Office"
                required
                value={header.officeId}
                error={errors.officeId}
                disabled={!!existing}
                options={lookups.offices.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
                onChange={(event) => {
                  set("officeId", event.target.value);
                  setLines([]);
                }}
              />
              <SelectField
                label="Target Type"
                required
                value={header.basis}
                error={errors.basis}
                options={[{ value: "", label: "Target Type" }, ...TARGET_BASES.map((value) => ({ value, label: PLAN_BASIS_LABELS[value] }))]}
                onChange={(event) => set("basis", event.target.value as TargetBasis)}
              />
              <TextField label="Target Name" required value={header.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
              <TextField
                label={header.basis === "QUANTITY" ? "Sales Target Quantity" : "Sales Target Amount"}
                type="number"
                min={0}
                step="any"
                required
                value={header.targetAmount}
                error={errors.targetAmount}
                onChange={(event) => set("targetAmount", event.target.value)}
              />
              <TextField label="Start Date" type="date" required value={header.startDate} error={errors.startDate} onChange={(event) => set("startDate", event.target.value)} />
              <TextField label="End Date" type="date" required value={header.endDate} error={errors.endDate} onChange={(event) => set("endDate", event.target.value)} />
              <TextAreaField label="Remarks" rows={2} className="lg:col-span-3" value={header.remarks} error={errors.remarks} onChange={(event) => set("remarks", event.target.value)} />
              <div className="flex items-end">
                <Button variant="primary" onClick={() => save(true)} disabled={busy}>
                  Assign
                </Button>
              </div>
            </div>
          </Section>
        </Card>

        <Card>
          <Section
            title="Customer Lists"
            description={`Leave empty to count sales to every customer. ${lines.length ? `Lines total ${formatAmount(linesTotal)}.` : ""}`}
            actions={
              <CheckboxField
                label="Customer Group Wise"
                checked={groupWise}
                onChange={(event) => {
                  setGroupWise(event.target.checked);
                  setLines([]);
                  setEntry({ ...entry, partyId: "" });
                }}
              />
            }
          >
            <div
              className="grid items-end gap-3 rounded-lg bg-canvas p-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto]"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
                  event.preventDefault();
                  add();
                }
              }}
            >
              <SelectField
                label={groupWise ? "Customer Group" : "Customer Name"}
                required
                value={entry.partyId}
                disabled={masters.loading}
                options={[{ value: "", label: masters.loading ? "Loading…" : groupWise ? "Select customer group" : "Select customer" }, ...parties.map((party) => ({ value: party.id, label: party.name }))]}
                onChange={(event) => setEntry({ ...entry, partyId: event.target.value })}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor={`${listId}-item`} className="text-xs text-ink-muted">
                  Item Name
                </label>
                <input id={`${listId}-item`} list={listId} value={entry.itemText} placeholder="All items" onChange={(event) => pickItem(event.target.value)} className={cn(CONTROL, "h-7")} />
                <datalist id={listId}>
                  {items.map((item) => (
                    <option key={item.id} value={itemLabel(item)} />
                  ))}
                </datalist>
              </div>
              <TextField
                label="Rate"
                type="number"
                min={0}
                step="any"
                value={entry.rate}
                onChange={(event) => setEntry({ ...entry, rate: event.target.value, amount: entry.qty ? String(round2(toNumber(entry.qty) * toNumber(event.target.value))) : entry.amount })}
              />
              <TextField
                label="Quantity"
                type="number"
                min={0}
                step="any"
                value={entry.qty}
                onChange={(event) => setEntry({ ...entry, qty: event.target.value, amount: entry.rate ? String(round2(toNumber(entry.rate) * toNumber(event.target.value))) : entry.amount })}
              />
              <TextField label="Amount" type="number" min={0} step="any" required value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} />
              <Button onClick={add} disabled={!masters.data}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </div>
            {lines.length === 0 ? (
              <EmptyState title="No Data Found" subtitle="No customers added (all customers will be counted by default)." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-canvas text-xs text-ink-muted">
                    <tr className="border-b border-line">
                      {["SL", groupWise ? "Customer Group" : "Customer", "Item", "Rate", "Quantity", "Amount", ""].map((label, index) => (
                        <th key={label || index} scope="col" className={cn("px-2 py-2 font-medium", index >= 3 && index <= 5 ? "text-right" : "text-left")}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lines.map((line, index) => (
                      <tr key={line.key}>
                        <td className="px-2 py-1.5 text-ink-faint">{index + 1}</td>
                        <td className="px-2 py-1.5 text-ink">{partyName(line.partyId)}</td>
                        <td className="px-2 py-1.5">{line.itemId ? itemName(line.itemId) : "All items"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{line.rate || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{line.qty || "—"}</td>
                        <td className="px-2 py-1.5 text-right font-medium text-ink tabular-nums">{formatAmount(toNumber(line.amount))}</td>
                        <td className="px-1 py-1">
                          <Button variant="ghost" size="icon" aria-label={`Remove row ${index + 1}`} onClick={() => setLines(lines.filter((candidate) => candidate.key !== line.key))}>
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-line-strong bg-canvas font-medium text-ink">
                    <tr>
                      <td colSpan={5} className="px-2 py-2 text-right">
                        Total
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatAmount(linesTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {errors.lines && <p className="text-xs text-danger">{errors.lines}</p>}
          </Section>
        </Card>
      </div>
    </Frame>
  );
}

// ─── Target (Assign Sales Force) ─────────────────────────────────────────────

interface AssignRow {
  key: string;
  salesPersonId: string;
  customerGroupId: string;
  targetAmount: string;
  commissionBasis: CommissionBasis;
  commissionRate: string;
  minimumCollection: string;
}

export function AssignFormView() {
  const params = useSearchParams();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const back = paths.targetTab("sales-target");
  if (lookups.error) return <Waiting title="Target (Assign Sales Force)" back={back} error={lookups.error} onRetry={lookups.reload} />;
  if (!lookups.data) return <Waiting title="Target (Assign Sales Force)" back={back} />;
  return <AssignEditor lookups={lookups.data} initialPlanId={params.get("plan") ?? ""} />;
}

function AssignEditor({ lookups, initialPlanId }: { lookups: SalesLookups; initialPlanId: string }) {
  const router = useRouter();
  const { busy, errors, fail, run, toast } = useSubmit();
  const plans = useResource("target-plans:all", () => fetchPlans({}));
  const [planId, setPlanId] = useState(initialPlanId);
  const plan = plans.data?.find((candidate) => candidate.id === planId);
  const [officeId, setOfficeId] = useState("");
  const effectiveOffice = officeId || plan?.officeId || lookups.offices[0]?.id || "";
  const office = lookups.offices.find((candidate) => candidate.id === effectiveOffice);
  const masters = useUnitMasters(office?.businessUnitId ?? null);
  const detail = useResource(planId ? `plan:${planId}` : null, () => fetchPlan(planId));
  const [rows, setRows] = useState<AssignRow[] | null>(null);
  const [entry, setEntry] = useState<Omit<AssignRow, "key">>({ salesPersonId: "", customerGroupId: "", targetAmount: "", commissionBasis: "AMOUNT", commissionRate: "", minimumCollection: "" });

  // Already assigned sales force start in the list, so saving keeps them up to date.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (detail.data && seededFor !== detail.data.id) {
    setSeededFor(detail.data.id);
    setRows(
      detail.data.assignments.map((row) => ({
        key: newKey(),
        salesPersonId: row.salesPersonId,
        customerGroupId: row.customerGroupId ?? "",
        targetAmount: String(row.targetAmount),
        commissionBasis: row.commissionBasis,
        commissionRate: String(row.commissionRate),
        minimumCollection: String(row.minimumCollection),
      })),
    );
  }
  const list = rows ?? [];
  const persons = masters.data?.setup.salesPersons ?? [];
  const groups = masters.data?.setup.customerGroups ?? [];
  const personName = (personId: string) => persons.find((person) => person.id === personId)?.name ?? detail.data?.assignments.find((row) => row.salesPersonId === personId)?.salesPersonName ?? "Unknown";
  const officePlans = (plans.data ?? []).filter((candidate) => candidate.officeId === effectiveOffice);

  function add() {
    if (!planId) return toast.error("Select a target name.");
    if (!entry.salesPersonId) return toast.error("Select an employee.");
    if (!(toNumber(entry.targetAmount) > 0)) return toast.error("Enter the target amount.");
    if (entry.commissionRate.trim() === "") return toast.error("Enter the commission rate.");
    if (entry.minimumCollection.trim() === "") return toast.error("Enter the minimum collection.");
    const others = list.filter((row) => row.salesPersonId !== entry.salesPersonId);
    setRows([...others, { ...entry, key: newKey() }]);
    setEntry({ ...entry, salesPersonId: "", targetAmount: "", minimumCollection: "" });
  }

  function save() {
    const input = {
      planId,
      rows: list.map((row) => ({
        salesPersonId: row.salesPersonId,
        customerGroupId: row.customerGroupId || null,
        targetAmount: toNumber(row.targetAmount),
        commissionBasis: row.commissionBasis,
        commissionRate: toNumber(row.commissionRate),
        minimumCollection: toNumber(row.minimumCollection),
      })),
    };
    const parsed = assignInputSchema.safeParse(input);
    if (!parsed.success) return fail(issuesToErrors(parsed.error));
    void run(async () => {
      const saved = await assignPlan(input);
      toast.success(`${saved.assigned} sales force assigned to ${saved.name}.`);
      router.replace(paths.plan(saved.id));
    });
  }
  useSaveShortcut(save, true);

  return (
    <Frame
      title="Target (Assign Sales Force)"
      back={planId ? paths.plan(planId) : paths.targetTab("sales-target")}
      subtitle={plan ? `${plan.name} · ${plan.number} · target ${formatAmount(plan.targetAmount)}` : undefined}
      actions={
        <Button variant="primary" onClick={save} loading={busy} disabled={!planId || list.length === 0}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-6">
              <SelectField
                label="Office"
                required
                value={effectiveOffice}
                options={lookups.offices.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
                onChange={(event) => {
                  setOfficeId(event.target.value);
                  setPlanId("");
                  setRows(null);
                  setSeededFor(null);
                }}
              />
              <SelectField
                label="Target Name"
                required
                className="lg:col-span-2"
                value={planId}
                error={errors.planId}
                options={[{ value: "", label: plans.loading ? "Loading…" : "Select target" }, ...officePlans.map((candidate) => ({ value: candidate.id, label: `${candidate.name} (${candidate.number})` }))]}
                onChange={(event) => {
                  setPlanId(event.target.value);
                  setRows(null);
                  setSeededFor(null);
                }}
              />
            </div>
            <div
              className="grid items-end gap-3 rounded-lg bg-canvas p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto]"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
                  event.preventDefault();
                  add();
                }
              }}
            >
              <SelectField
                label="Employee Name"
                required
                value={entry.salesPersonId}
                disabled={!masters.data}
                options={[{ value: "", label: "Employee Name" }, ...persons.map((person) => ({ value: person.id, label: `${person.name}${person.designation ? ` (${person.designation})` : ""}` }))]}
                onChange={(event) => setEntry({ ...entry, salesPersonId: event.target.value })}
              />
              <SelectField
                label="Customer Group"
                value={entry.customerGroupId}
                options={[{ value: "", label: "All" }, ...groups.map((group) => ({ value: group.id, label: group.name }))]}
                onChange={(event) => setEntry({ ...entry, customerGroupId: event.target.value })}
              />
              <TextField label="Target Amount" type="number" min={0} step="any" required value={entry.targetAmount} onChange={(event) => setEntry({ ...entry, targetAmount: event.target.value })} />
              <SelectField
                label="Commission Type"
                required
                value={entry.commissionBasis}
                options={COMMISSION_BASES.map((value) => ({ value, label: COMMISSION_BASIS_LABELS[value] }))}
                onChange={(event) => setEntry({ ...entry, commissionBasis: event.target.value as CommissionBasis })}
              />
              <TextField
                label={entry.commissionBasis === "PERCENT" ? "Commission Rate (%)" : "Commission Rate (Amount)"}
                type="number"
                min={0}
                max={entry.commissionBasis === "PERCENT" ? 100 : undefined}
                step="any"
                required
                value={entry.commissionRate}
                onChange={(event) => setEntry({ ...entry, commissionRate: event.target.value })}
              />
              <TextField label="Minimum Collection" type="number" min={0} step="any" required value={entry.minimumCollection} onChange={(event) => setEntry({ ...entry, minimumCollection: event.target.value })} />
              <Button onClick={add}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </div>
          </Section>
        </Card>

        <Card>
          {!planId ? (
            <EmptyState title="No Data Found" subtitle="Select a target name to view or add assignments." />
          ) : list.length === 0 ? (
            <EmptyState title="No Data Found" subtitle="No sales force assigned yet. Select employee details above and click Add." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-canvas text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    {["SL", "Employee", "Customer Group", "Target Amount", "Commission", "Min. Collection", ""].map((label, index) => (
                      <th key={label || index} scope="col" className={cn("px-3 py-2 font-medium", index >= 3 && index <= 5 ? "text-right" : "text-left")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((row, index) => (
                    <tr key={row.key}>
                      <td className="px-3 py-2 text-ink-faint">{index + 1}</td>
                      <td className="px-3 py-2 text-ink">{personName(row.salesPersonId)}</td>
                      <td className="px-3 py-2">{groups.find((group) => group.id === row.customerGroupId)?.name ?? "All"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatAmount(toNumber(row.targetAmount))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.commissionBasis === "PERCENT" ? `${row.commissionRate}%` : formatAmount(toNumber(row.commissionRate))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatAmount(toNumber(row.minimumCollection))}</td>
                      <td className="px-2 py-1 text-right">
                        <Button variant="ghost" size="icon" aria-label={`Remove ${personName(row.salesPersonId)}`} title="Remove from this list (already saved ones are removed on the target page)" onClick={() => setRows(list.filter((candidate) => candidate.key !== row.key))}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errors.rows && <p className="px-4 pb-3 text-xs text-danger">{errors.rows}</p>}
        </Card>
      </div>
    </Frame>
  );
}

// ─── Commission Setup ────────────────────────────────────────────────────────

interface CommissionLineValues {
  itemId: string;
  basis: CommissionBasis;
  value: string;
}

export function CommissionFormView({ id }: { id?: string }) {
  const today = useToday();
  const lookups = useResource("sales-lookups", fetchSalesLookups);
  const commission = useResource(id ? `commission:${id}` : null, () => fetchCommission(id!));
  const title = id ? "Edit Commission Setup" : "Create Commission Setup";
  const back = paths.targetTab("commission-setup");
  if (lookups.error || commission.error) return <Waiting title={title} back={back} error={lookups.error ?? commission.error} onRetry={lookups.reload} />;
  if (!today || !lookups.data || (id && !commission.data)) return <Waiting title={title} back={back} />;
  return <CommissionEditor key={commission.data?.updatedAt ?? "new"} today={today} lookups={lookups.data} existing={commission.data ?? null} />;
}

function CommissionEditor({ today, lookups, existing }: { today: string; lookups: SalesLookups; existing: Awaited<ReturnType<typeof fetchCommission>> | null }) {
  const router = useRouter();
  const listId = useId();
  const { busy, errors, fail, run, toast } = useSubmit();
  const units = [...new Map(lookups.offices.map((office) => [office.businessUnitId, office.businessUnitName])).entries()];
  const [businessUnitId, setBusinessUnitId] = useState(existing?.businessUnitId ?? units[0]?.[0] ?? "");
  const [header, setHeader] = useState({
    customerGroupId: existing?.customerGroupId ?? "",
    salesPersonId: existing?.salesPersonId ?? "",
    name: existing?.name ?? "",
    fromDate: existing?.fromDate ?? today,
    toDate: existing?.toDate ?? `${today.slice(0, 8)}${new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()}`,
  });
  const [lines, setLines] = useState<CommissionLineValues[]>(() => (existing?.lines ?? []).map((line) => ({ itemId: line.itemId, basis: line.basis, value: String(line.value) })));
  const [category, setCategory] = useState<[string, string, string]>(["", "", ""]);
  const [entry, setEntry] = useState({ itemText: "", all: false, basis: "AMOUNT" as CommissionBasis, value: "" });
  const set = <K extends keyof typeof header>(key: K, value: (typeof header)[K]) => setHeader((current) => ({ ...current, [key]: value }));

  const masters = useUnitMasters(businessUnitId || null);
  const items = useMemo(() => masters.data?.items ?? [], [masters.data]);
  const categories = useMemo(() => masters.data?.setup.categories ?? [], [masters.data]);
  const chosen = category[2] || category[1] || category[0];
  const allowed = useMemo(() => {
    if (!chosen) return null;
    const ids = new Set([chosen]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of categories) {
        if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
          ids.add(candidate.id);
          grew = true;
        }
      }
    }
    return ids;
  }, [chosen, categories]);
  const visible = allowed ? items.filter((item) => item.categoryId && allowed.has(item.categoryId)) : items;
  const itemLabel = (item: ItemOption) => `${item.code} — ${item.name}`;
  const itemOf = (itemId: string) => items.find((item) => item.id === itemId) ?? existing?.lines.find((line) => line.itemId === itemId);

  function add() {
    const picked = entry.all ? visible : items.filter((item) => itemLabel(item) === entry.itemText);
    if (picked.length === 0) return toast.error(entry.all ? "No items in this category." : "Select an item from the list.");
    if (entry.value.trim() === "" || toNumber(entry.value) < 0) return toast.error("Enter the commission.");
    if (entry.basis === "PERCENT" && toNumber(entry.value) > 100) return toast.error("A percentage commission can be at most 100.");
    const ids = new Set(picked.map((item) => item.id));
    setLines([...lines.filter((line) => !ids.has(line.itemId)), ...picked.map((item) => ({ itemId: item.id, basis: entry.basis, value: entry.value }))]);
    setEntry({ ...entry, itemText: "", all: false });
  }

  function save() {
    const input = {
      ...header,
      customerGroupId: header.customerGroupId || null,
      lines: lines.map((line) => ({ itemId: line.itemId, basis: line.basis, value: toNumber(line.value) })),
    };
    const parsed = commissionInputSchema.safeParse(input);
    if (!parsed.success) return fail(issuesToErrors(parsed.error));
    void run(async () => {
      if (existing) await updateCommission(existing.id, existing.updatedAt, input);
      else await createCommission(input);
      toast.success(`${input.name} saved.`);
      router.replace(paths.targetTab("commission-setup"));
    });
  }
  useSaveShortcut(save, true);

  const level = (depth: 0 | 1 | 2) => {
    const parent = depth === 0 ? null : category[depth - 1];
    const choices = categories.filter((candidate) => candidate.level === depth + 1 && (depth === 0 || candidate.parentId === parent));
    const label = depth === 0 ? "Selling Item Category" : depth === 1 ? "Selling Item Sub Category" : "Selling Item Minor Category";
    const placeholder = depth === 0 ? "Select" : depth === 1 ? "Select" : "Minor Category";
    return (
      <SelectField
        label={label}
        value={category[depth]}
        disabled={depth > 0 && !parent}
        options={[{ value: "", label: placeholder }, ...choices.map((candidate) => ({ value: candidate.id, label: candidate.name }))]}
        onChange={(event) => {
          const next = [...category] as [string, string, string];
          next[depth] = event.target.value;
          for (let index = depth + 1; index < 3; index++) next[index] = "";
          setCategory(next);
        }}
      />
    );
  };

  return (
    <Frame
      title={existing ? `Edit ${existing.name}` : "Create Commission Setup"}
      back={paths.targetTab("commission-setup")}
      actions={
        <Button variant="primary" onClick={save} loading={busy}>
          SAVE
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Card>
          <Section>
            <div className="rounded border border-line bg-canvas p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input type="radio" checked readOnly className="size-4 accent-accent" />
                Item Commission
              </label>
            </div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
              {units.length > 1 && (
                <SelectField
                  label="Business Unit"
                  value={businessUnitId}
                  disabled={!!existing}
                  options={units.map(([unitId, name]) => ({ value: unitId, label: name }))}
                  onChange={(event) => {
                    setBusinessUnitId(event.target.value);
                    setLines([]);
                    set("salesPersonId", "");
                    set("customerGroupId", "");
                  }}
                />
              )}
              <SelectField
                label="Customer Group"
                value={header.customerGroupId}
                options={[{ value: "", label: "Customer Group" }, ...(masters.data?.setup.customerGroups ?? []).map((group) => ({ value: group.id, label: group.name }))]}
                onChange={(event) => set("customerGroupId", event.target.value)}
              />
              <SelectField
                label="Employee"
                required
                value={header.salesPersonId}
                error={errors.salesPersonId}
                options={[{ value: "", label: "Select employee" }, ...(masters.data?.setup.salesPersons ?? []).map((person) => ({ value: person.id, label: `${person.name}${person.designation ? ` (${person.designation})` : ""}` }))]}
                onChange={(event) => set("salesPersonId", event.target.value)}
              />
              <TextField label="Commission Name" required placeholder="Commission Name" value={header.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
              <TextField label="From Date" type="date" required value={header.fromDate} error={errors.fromDate} onChange={(event) => set("fromDate", event.target.value)} />
              <TextField label="To Date" type="date" required value={header.toDate} error={errors.toDate} onChange={(event) => set("toDate", event.target.value)} />
            </div>
          </Section>
        </Card>

        <Card>
          <Section>
            <div className="grid gap-3 sm:grid-cols-3">
              {level(0)}
              {level(1)}
              {level(2)}
            </div>
            <div
              className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_auto]"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
                  event.preventDefault();
                  add();
                }
              }}
            >
              <div className="flex flex-col gap-1">
                <span className="flex items-center justify-between">
                  <label htmlFor={`${listId}-item`} className="text-xs text-ink-muted">
                    Select Item <span className="text-danger">*</span>
                  </label>
                  <CheckboxField label="All" checked={entry.all} onChange={(event) => setEntry({ ...entry, all: event.target.checked })} />
                </span>
                <input
                  id={`${listId}-item`}
                  list={listId}
                  value={entry.all ? "" : entry.itemText}
                  disabled={entry.all || !masters.data}
                  placeholder="Select/Search Item (min 3 letters)"
                  onChange={(event) => setEntry({ ...entry, itemText: event.target.value })}
                  className={cn(CONTROL, "h-7")}
                />
                <datalist id={listId}>
                  {visible.map((item) => (
                    <option key={item.id} value={itemLabel(item)} />
                  ))}
                </datalist>
              </div>
              <SelectField
                label="Amount/Percentage Wise"
                value={entry.basis}
                options={[{ value: "", label: "Amount/Percentage Wise" }, ...COMMISSION_BASES.map((value) => ({ value, label: value === "AMOUNT" ? "Amount" : "Percentage" }))]}
                onChange={(event) => setEntry({ ...entry, basis: (event.target.value || "AMOUNT") as CommissionBasis })}
              />
              <TextField label="Commission" placeholder="Commission" type="number" min={0} step="any" value={entry.value} onChange={(event) => setEntry({ ...entry, value: event.target.value })} />
              <Button onClick={add}>
                Add List
              </Button>
            </div>
            {lines.length === 0 ? (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-[#e8f1fc] text-xs font-semibold text-ink">
                    <tr className="border-b border-line">
                      {["SL", "Item Name", "UOM", "Amount/Percentage Wise", "Commission", "Actions"].map((label, index) => (
                        <th key={label} scope="col" className={cn("px-3 py-2.5", index === 4 ? "text-right" : "text-left")}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={6} className="p-0">
                        <EmptyState title="No Data Found" subtitle="No items added yet. Choose category and item details above, then click Add List." />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-canvas text-xs text-ink-muted">
                    <tr className="border-b border-line">
                      {["SL", "Item Name", "UOM", "Amount/Percentage Wise", "Commission", "Actions"].map((label, index) => (
                        <th key={label} scope="col" className={cn("px-2 py-2 font-medium", index === 4 ? "text-right" : "text-left")}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lines.map((line, index) => {
                      const item = itemOf(line.itemId);
                      const name = item ? ("name" in item ? item.name : item.itemName) : "Unknown";
                      return (
                        <tr key={line.itemId}>
                          <td className="px-2 py-1.5 text-ink-faint">{index + 1}</td>
                          <td className="px-2 py-1.5 text-ink">{name}</td>
                          <td className="px-2 py-1.5">{item?.uom ?? "—"}</td>
                          <td className="w-48 px-2 py-1">
                            <select
                              aria-label={`Commission type of ${name}`}
                              value={line.basis}
                              onChange={(event) => setLines(lines.map((candidate) => (candidate === line ? { ...candidate, basis: event.target.value as CommissionBasis } : candidate)))}
                              className={cn(CONTROL, "h-7 w-full")}
                            >
                              {COMMISSION_BASES.map((value) => (
                                <option key={value} value={value}>
                                  {COMMISSION_BASIS_LABELS[value]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="w-36 px-2 py-1">
                            <input
                              aria-label={`Commission of ${name}`}
                              type="number"
                              min={0}
                              step="any"
                              value={line.value}
                              onChange={(event) => setLines(lines.map((candidate) => (candidate === line ? { ...candidate, value: event.target.value } : candidate)))}
                              className={cn(CONTROL, "h-7 w-full text-right tabular-nums")}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={() => setLines(lines.filter((candidate) => candidate !== line))}>
                              <Trash2 />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {errors.lines && <p className="text-xs text-danger">{errors.lines}</p>}
          </Section>
        </Card>
      </div>
    </Frame>
  );
}
