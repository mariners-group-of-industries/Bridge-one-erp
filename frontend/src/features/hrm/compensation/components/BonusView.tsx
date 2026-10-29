"use client";

import { Check, Gift, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, Field, FormGrid, Input, Notice, Select, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { ApplicationStatusBadge, Grid } from "../../self-service/leave-movement/components/shared";
import { hrmPaths } from "../../paths";
import { FilterBar, FilterField, OfficeSelect, formatDate, formatMoney, useHrOptions } from "../../shared/hr-ui";
import { APPROVAL_STATUSES, type BonusAdviceRow, type BonusRunRow } from "../types";

const TABS = [
  { id: "advice", label: "Bonus Advice" },
  { id: "generate", label: "Bonus Generate" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const td = TABLE.td;
const num = `${TABLE.td} text-right tabular-nums`;

export function BonusView() {
  const [tab, setTab] = useState<TabId>("advice");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState("");
  const [creating, setCreating] = useState(false);
  const query = applied ? `?status=${applied}` : "";
  const runs = useResource(`hrm-bonus-runs${query}`, () => apiRequest<BonusRunRow[]>(`/api/hrm/bonus${query}`));
  const advice = useResource(tab === "advice" ? `hrm-bonus-advice${query}` : null, () => apiRequest<BonusAdviceRow[]>(`/api/hrm/bonus/advice${query}`));
  const current = tab === "advice" ? advice : runs;
  const reload = () => {
    runs.reload();
    advice.reload();
  };

  return (
    <PageContainer full>
      <PageHead
        title="Bonus"
        subtitle="Bonuses are a percentage of each eligible employee's gross salary, and are paid once approved."
        breadcrumbs={resolveBreadcrumbs(hrmPaths.bonus).slice(1)}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-3.5" />
            Create
          </Button>
        }
      />
      <section className="rounded border border-line bg-surface shadow-xs">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Bonus">
          <div className="flex flex-col gap-3 p-4">
            <FilterBar onSubmit={() => setApplied(status)} busy={current.loading}>
              <FilterField label="Status">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={APPROVAL_STATUSES} />}</FilterField>
            </FilterBar>
            {current.error ? (
              <ErrorState message={current.error.message} onRetry={current.reload} />
            ) : !current.data ? (
              <LoadingState label="Loading bonuses…" />
            ) : current.data.length === 0 ? (
              <EmptyBlock icon={<Gift />} title="No bonuses yet">
                Use Create to generate a bonus.
              </EmptyBlock>
            ) : tab === "advice" ? (
              <AdviceTable rows={advice.data ?? []} loading={advice.loading} />
            ) : (
              <RunsTable rows={runs.data ?? []} loading={runs.loading} onChanged={reload} />
            )}
          </div>
        </Tabs>
      </section>
      <CreateBonusDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          setTab("generate");
          reload();
        }}
      />
    </PageContainer>
  );
}

function AdviceTable({ rows, loading }: { rows: BonusAdviceRow[]; loading: boolean }) {
  return (
    <Grid headers={["SL", "Bonus", "Bonus Date", "Employee Code", "Employee Name", "Office", "Service (months)", "Gross Salary", "Bonus Amount", "Status"]} loading={loading}>
      {rows.map((r, i) => (
        <tr key={r.id} className={TABLE.row}>
          <td className={`${num} text-ink-faint`}>{i + 1}</td>
          <td className={`${td} whitespace-nowrap`}>{r.bonusName}</td>
          <td className={`${td} tabular-nums`}>{formatDate(r.bonusDate)}</td>
          <td className={`${td} tabular-nums`}>{r.employeeCode}</td>
          <td className={`${td} whitespace-nowrap`}>{r.employeeName}</td>
          <td className={td}>{r.officeName}</td>
          <td className={num}>{r.serviceMonths}</td>
          <td className={num}>{formatMoney(r.grossSalary)}</td>
          <td className={`${num} font-semibold`}>{formatMoney(r.amount)}</td>
          <td className={td}>
            <ApplicationStatusBadge status={r.status} />
          </td>
        </tr>
      ))}
    </Grid>
  );
}

function RunsTable({ rows, loading, onChanged }: { rows: BonusRunRow[]; loading: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<{ row: BonusRunRow; action: "reject" | "delete" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(row: BonusRunRow, action: "approve" | "reject" | "delete") {
    setBusy(true);
    try {
      await apiRequest(action === "delete" ? `/api/hrm/bonus/${row.id}` : `/api/hrm/bonus/${row.id}/${action}`, { method: action === "delete" ? "DELETE" : "POST" });
      toast.success(action === "delete" ? "Bonus deleted." : action === "approve" ? "Bonus approved." : "Bonus rejected.");
      setConfirm(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Grid headers={["SL", "Action", "Bonus", "Office", "Bonus Date", "% of Gross", "Min. Service (months)", "Employees", "Total Amount", "Status", "Created By"]} loading={loading}>
        {rows.map((r, i) => (
          <tr key={r.id} className={TABLE.row}>
            <td className={`${num} text-ink-faint`}>{i + 1}</td>
            <td className={`${td} px-1 py-1`}>
              {r.status === "Pending" ? (
                <div className="flex items-center justify-center gap-0.5">
                  <Button variant="ghost" size="icon" className="hover:text-success" title="Approve" aria-label={`Approve ${r.name}`} disabled={busy} onClick={() => void act(r, "approve")}>
                    <Check />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-danger"
                    title="Reject"
                    aria-label={`Reject ${r.name}`}
                    disabled={busy}
                    onClick={() => setConfirm({ row: r, action: "reject" })}
                  >
                    <X />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:text-danger"
                    title="Delete"
                    aria-label={`Delete ${r.name}`}
                    disabled={busy}
                    onClick={() => setConfirm({ row: r, action: "delete" })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : (
                <span className="block text-center text-ink-faint">—</span>
              )}
            </td>
            <td className={`${td} whitespace-nowrap font-medium`}>{r.name}</td>
            <td className={td}>{r.officeName}</td>
            <td className={`${td} tabular-nums`}>{formatDate(r.bonusDate)}</td>
            <td className={num}>{r.percentOfGross}%</td>
            <td className={num}>{r.minServiceMonths}</td>
            <td className={num}>{r.employeeCount}</td>
            <td className={`${num} font-semibold`}>{formatMoney(r.totalAmount)}</td>
            <td className={td} title={r.decidedByName ? `${r.status} by ${r.decidedByName}` : undefined}>
              <ApplicationStatusBadge status={r.status} />
            </td>
            <td className={td}>{r.createdByName ?? "—"}</td>
          </tr>
        ))}
      </Grid>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === "reject" ? "Reject bonus" : "Delete bonus"}
        message={confirm && `${confirm.action === "reject" ? "Reject" : "Delete"} “${confirm.row.name}” (${formatMoney(confirm.row.totalAmount)} for ${confirm.row.employeeCount} employees)?`}
        confirmLabel={confirm?.action === "reject" ? "Reject" : "Delete"}
        busy={busy}
        onConfirm={() => confirm && void act(confirm.row, confirm.action)}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

const EMPTY = { name: "", officeId: "", bonusDate: "", percentOfGross: "", minServiceMonths: "0" };

function CreateBonusDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const options = useHrOptions();
  const [form, setForm] = useState(EMPTY);
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!form.name.trim() || !form.bonusDate || !(Number(form.percentOfGross) > 0)) {
      setFailure("Enter the bonus name, bonus date and a percentage above 0.");
      return;
    }
    setSaving(true);
    setFailure("");
    try {
      const result = await apiRequest<{ employeeCount: number }>("/api/hrm/bonus", { method: "POST", body: JSON.stringify(form) });
      toast.success(`Bonus generated for ${result.employeeCount} employees; waiting for approval.`);
      setForm(EMPTY);
      onCreated();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Create Bonus"
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Generate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {failure && <Notice tone="error">{failure}</Notice>}
        <FormGrid cols={2}>
          <Field label="Bonus Name" required span={2}>
            {(id) => <Input id={id} value={form.name} maxLength={100} placeholder="e.g. Eid-ul-Fitr Bonus 2026" onChange={(e) => set("name")(e.target.value)} />}
          </Field>
          <Field label="Office" hint="Leave empty for all offices.">
            {(id) => <OfficeSelect id={id} options={options.data} value={form.officeId} onChange={set("officeId")} />}
          </Field>
          <Field label="Bonus Date" required>
            {(id) => <Input id={id} type="date" value={form.bonusDate} onChange={(e) => set("bonusDate")(e.target.value)} />}
          </Field>
          <Field label="% of Gross Salary" required>
            {(id) => <Input id={id} type="number" min="0" step="0.01" value={form.percentOfGross} onChange={(e) => set("percentOfGross")(e.target.value)} className="text-right" />}
          </Field>
          <Field label="Min. Service (months)" hint="Months served by the bonus date.">
            {(id) => <Input id={id} type="number" min="0" step="1" value={form.minServiceMonths} onChange={(e) => set("minServiceMonths")(e.target.value)} className="text-right" />}
          </Field>
        </FormGrid>
      </div>
    </Dialog>
  );
}
