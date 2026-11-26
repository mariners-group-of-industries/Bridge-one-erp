"use client";

import { ArrowLeft, Calculator, Save, Search, Send, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest, errorMessage } from "@/lib/api/client";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, Field, FormGrid, Input, Panel, Select, TextArea } from "@/features/configuration/entity-master-data/employee/components/kit";
import { hrmPaths } from "../../paths";
import { MONTHS, YEARS, formatDate, monthLabel, useHrOptions } from "../../shared/hr-ui";
import { defaultPayrollDate, defaultPeriodEnd, lastClosedPayrollMonth } from "../period";
import { SALARY_TYPES, type LineSort, type PayrollLine, type PayrollLineDetail, type PayrollPreview, type PayrollSequence } from "../batch-types";
import { ActionDialog, Callout, PayrollStatusBadge, PayrollSummary, SalaryDetailDialog, SalaryTable, bdt } from "./payroll-ui";

interface Form {
  businessUnitId: string;
  officeId: string;
  salaryType: string;
  month: string;
  year: string;
  payrollDate: string;
  description: string;
}

const PAGE_SIZES = [25, 50, 100] as const;
const SORT_VALUE: Record<LineSort, (l: PayrollLine) => string | number> = {
  sl: (l) => l.sl,
  code: (l) => l.employeeCode,
  name: (l) => l.employeeName.toLowerCase(),
  gross: (l) => l.grossSalary,
  net: (l) => l.netPayable,
  deduction: (l) => l.totalDeduction,
};

export function SalaryGenerateView({ initial }: { initial: { officeId?: string; month?: string; year?: string } }) {
  const router = useRouter();
  const toast = useToast();
  const options = useHrOptions();
  const [form, setForm] = useState<Form>(() => ({
    businessUnitId: "",
    officeId: initial.officeId ?? "",
    salaryType: SALARY_TYPES[0],
    // Opens on the salary that is due: the last period that has ended (on 22 Nov, 21 Oct – 20 Nov).
    month: /^(0[1-9]|1[0-2])$/.test(initial.month ?? "") ? initial.month! : lastClosedPayrollMonth().month,
    year: /^\d{4}$/.test(initial.year ?? "") ? initial.year! : lastClosedPayrollMonth().year,
    // Empty = the default pay date, which follows the period (see payrollDate below).
    payrollDate: "",
    description: "",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [busy, setBusy] = useState<"generate" | "draft" | "submit" | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [detail, setDetail] = useState<PayrollLineDetail | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ by: LineSort; dir: "asc" | "desc" }>({ by: "sl", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  const offices = useMemo(() => options.data?.offices ?? [], [options.data]);
  const branches = useMemo(() => [...new Map(offices.map((o) => [o.businessUnitId, o.businessUnit])).entries()].map(([value, label]) => ({ value, label })), [offices]);
  // The office decides the branch; a branch chosen first narrows the offices.
  const businessUnitId = offices.find((o) => o.id === form.officeId)?.businessUnitId ?? form.businessUnitId;
  const officeOptions = offices.filter((o) => !businessUnitId || o.businessUnitId === businessUnitId).map((o) => ({ value: o.id, label: o.name }));

  // Once the office has a payroll, the next one must be for the month right after it.
  const sequence = useResource(form.officeId ? `hrm-payroll-next:${form.officeId}:${form.salaryType}` : null, () =>
    apiRequest<PayrollSequence | null>(`/api/hrm/payroll/batches/next?${new URLSearchParams({ officeId: form.officeId, salaryType: form.salaryType })}`),
  );
  const required = form.officeId ? (sequence.data ?? null) : null;
  const month = required ? required.nextMonth.slice(5, 7) : form.month;
  const year = required ? required.nextMonth.slice(0, 4) : form.year;
  // Paid on the 5th of the month after the period ends (21 Oct – 20 Nov → 5 Dec) unless HR picks another date.
  const periodEnd = preview?.toDate ?? defaultPeriodEnd(`${year}-${month}`);
  const payrollDate = form.payrollDate || defaultPayrollDate(periodEnd);

  /** Any change to what is being calculated discards the preview: it must be generated again. */
  function set<K extends keyof Form>(key: K, value: Form[K], keepsPreview = false) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    if (!keepsPreview) setPreview(null);
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!businessUnitId) next.businessUnitId = "Select a branch.";
    if (!form.officeId) next.officeId = "Select an office.";
    if (!payrollDate) next.payrollDate = "Select the payroll date.";
    if (form.description.length > 500) next.description = "At most 500 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const payload = () => ({ officeId: form.officeId, month: `${year}-${month}`, salaryType: form.salaryType, payrollDate, description: form.description });

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    if (!validate()) return;
    if (form.officeId && sequence.loading) return void toast.info("Checking the office's last payroll; try again in a moment.");
    setBusy("generate");
    try {
      const result = await apiRequest<PayrollPreview>("/api/hrm/payroll/batches/preview", { method: "POST", body: JSON.stringify(payload()) });
      setPreview(result);
      setPage(1);
      setSearch("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  /** Saves the draft (the server calculates it again); `submit` also sends it for approval. */
  async function save(submit: boolean) {
    if (!preview || !validate()) return;
    setBusy(submit ? "submit" : "draft");
    try {
      const { id, reference } = await apiRequest<{ id: string; reference: string }>("/api/hrm/payroll/batches", { method: "POST", body: JSON.stringify(payload()) });
      if (submit) {
        try {
          await apiRequest(`/api/hrm/payroll/batches/${id}/submit`, { method: "POST", body: JSON.stringify({ version: 1 }) });
          toast.success(`Payroll ${reference} submitted for approval.`);
        } catch (error) {
          toast.error(`Payroll ${reference} was saved as a draft, but not submitted: ${errorMessage(error)}`);
        }
      } else toast.success(`Payroll ${reference} saved as a draft.`);
      router.push(hrmPaths.payrollBatch(id));
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
      setConfirmSubmit(false);
    }
  }

  const rows = useMemo(() => {
    if (!preview) return [];
    const q = search.trim().toLowerCase();
    const value = SORT_VALUE[sort.by];
    return preview.lines
      .filter((l) => !q || l.employeeCode.toLowerCase().includes(q) || l.employeeName.toLowerCase().includes(q))
      .sort((a, b) => {
        const [x, y] = [value(a), value(b)];
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "asc" ? 1 : -1) || a.sl - b.sl;
      });
  }, [preview, search, sort]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);

  const blocked = !preview || preview.lines.length === 0 || !!preview.existing || !preview.inSequence;
  const saving = busy === "draft" || busy === "submit";
  const period = monthLabel(`${year}-${month}`);

  return (
    <PageContainer full>
      <PageHead
        title="Salary Generate"
        subtitle="Calculate an office's salaries from employee salary, assigned calendars, attendance and the deduction policies; then save or submit for approval."
        breadcrumbs={resolveBreadcrumbs(hrmPaths.payrollGenerate).slice(1)}
        actions={
          <Link href={hrmPaths.payroll} className={buttonClasses("secondary", "md")}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Link>
        }
      />
      <div className="flex flex-col gap-3">
        <form onSubmit={generate} noValidate>
          <Panel
            title="Payroll details"
            footer={
              <>
                <Link href={hrmPaths.payroll} className={buttonClasses("ghost", "md")}>
                  Cancel
                </Link>
                <Button type="submit" variant={preview ? "secondary" : "primary"} loading={busy === "generate"} disabled={saving}>
                  <Calculator aria-hidden="true" />
                  {preview ? "Generate Again" : "Generate Salary"}
                </Button>
                <Button variant="accent-soft" loading={busy === "draft"} disabled={blocked || busy !== null} onClick={() => void save(false)} title={!preview ? "Generate the salary first" : undefined}>
                  <Save aria-hidden="true" />
                  Save Draft
                </Button>
                <Button variant="primary" disabled={blocked || busy !== null || (preview?.errorCount ?? 0) > 0} onClick={() => setConfirmSubmit(true)} title={!preview ? "Generate the salary first" : preview.errorCount > 0 ? "Fix the errors first" : undefined}>
                  <Send aria-hidden="true" />
                  Submit for Approval
                </Button>
              </>
            }
          >
            <FormGrid cols={4}>
              <Field label="Branch Name" required error={errors.businessUnitId}>
                {(id) => (
                  <Select
                    id={id}
                    value={businessUnitId}
                    aria-invalid={!!errors.businessUnitId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, businessUnitId: e.target.value, officeId: "" }));
                      setErrors((x) => ({ ...x, businessUnitId: undefined }));
                      setPreview(null);
                    }}
                    placeholder={options.loading ? "Loading…" : "Select branch"}
                    options={branches}
                  />
                )}
              </Field>
              <Field label="Office" required error={errors.officeId}>
                {(id) => <Select id={id} value={form.officeId} aria-invalid={!!errors.officeId} onChange={(e) => set("officeId", e.target.value)} placeholder={options.loading ? "Loading…" : "Select office"} options={officeOptions} />}
              </Field>
              <Field label="Salary Type" required>
                {(id) => <Select id={id} value={form.salaryType} onChange={(e) => set("salaryType", e.target.value)} placeholder={false} options={SALARY_TYPES} />}
              </Field>
              <Field label="Payroll Date" required error={errors.payrollDate} hint={`Payment date. Default: the 5th after the period ends (${formatDate(periodEnd)}).`}>
                {(id) => <Input id={id} type="date" value={payrollDate} aria-invalid={!!errors.payrollDate} onChange={(e) => set("payrollDate", e.target.value, true)} />}
              </Field>
              <Field
                label="Payroll Month"
                required
                hint={
                  required
                    ? `Fixed: the last payroll is ${monthLabel(required.lastMonth)} (${required.lastReference}), so the next is ${monthLabel(required.nextMonth)}.`
                    : preview
                      ? `Period: ${formatDate(preview.fromDate)} – ${formatDate(preview.toDate)}.`
                      : "Period: the 21st to the 20th, named after the month it ends in (November = 21 Oct – 20 Nov), unless a Payroll Rule sets another."
                }
              >
                {(id) => <Select id={id} value={month} disabled={!!required} onChange={(e) => set("month", e.target.value)} placeholder={false} options={MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }))} />}
              </Field>
              <Field label="Payroll Year" required>
                {(id) => <Select id={id} value={year} disabled={!!required} onChange={(e) => set("year", e.target.value)} placeholder={false} options={YEARS} />}
              </Field>
              <Field label="Description" span={2} error={errors.description} hint="Optional.">
                {(id) => <TextArea id={id} rows={2} maxLength={500} className="min-h-14" value={form.description} onChange={(e) => set("description", e.target.value, true)} />}
              </Field>
            </FormGrid>
          </Panel>
        </form>

        {!preview ? (
          <section className="rounded border border-line bg-surface p-4 shadow-xs">
            <EmptyBlock icon={<Users />} title={busy === "generate" ? "Calculating salaries…" : "Choose the payroll details and generate the salary"}>
              <p className="max-w-md text-center text-xs text-ink-muted">Nothing is saved until you choose Save Draft or Submit for Approval.</p>
            </EmptyBlock>
          </section>
        ) : (
          <>
            {preview.existing && (
              <Callout
                tone="danger"
                title={`Payroll ${preview.existing.reference} already exists for ${preview.officeName}, ${period}`}
                action={
                  <Link href={hrmPaths.payrollBatch(preview.existing.id)} className={buttonClasses("secondary", "sm")}>
                    Open {preview.existing.reference}
                  </Link>
                }
              >
                It is {preview.existing.status}. One payroll per office, salary type and month: open it to recalculate, or cancel it before generating a new one.
              </Callout>
            )}
            {!preview.inSequence && preview.sequence && (
              <Callout tone="danger" title={`${period} cannot be generated for ${preview.officeName}`}>
                The last payroll is {monthLabel(preview.sequence.lastMonth)} ({preview.sequence.lastReference}). Payrolls run month after month, so the next one must be {monthLabel(preview.sequence.nextMonth)}.
              </Callout>
            )}
            {preview.errorCount > 0 && (
              <Callout tone="danger" title={`${preview.errorCount} error(s) must be fixed before this payroll can be submitted`}>
                Open the marked employees to see what is missing. You can still save a draft.
              </Callout>
            )}
            {(preview.notices.length > 0 || preview.warningCount > 0) && (
              <Callout tone="warning" title="Check before you submit">
                <ul className="list-disc pl-4">
                  {preview.notices.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                  {preview.warningCount > 0 && <li>{preview.warningCount} remark(s) on individual employees (marked in the table).</li>}
                </ul>
              </Callout>
            )}
            <PayrollSummary totals={preview.totals} status={<PayrollStatusBadge status="Draft" />} eligibleCount={preview.eligibleCount} excluded={preview.excluded} />

            <section className="flex flex-col gap-3 rounded border border-line bg-surface p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">
                  Employee salaries · {preview.officeName} · {period}
                  <span className="ml-2 text-xs font-normal text-ink-muted">
                    {formatDate(preview.fromDate)} – {formatDate(preview.toDate)} · preview, not saved
                  </span>
                </h2>
                <div className="relative w-64 max-w-full">
                  <label htmlFor="salary-search" className="sr-only">
                    Search employees by name or code
                  </label>
                  <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
                  <Input
                    id="salary-search"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Employee name or code"
                    className="pl-8"
                    autoComplete="off"
                  />
                </div>
              </div>
              {preview.lines.length === 0 ? (
                <EmptyBlock icon={<Users />} title="No employee of this office has a salary for the month" />
              ) : rows.length === 0 ? (
                <EmptyBlock icon={<Search />} title="No employee matches the search" />
              ) : (
                <>
                  <SalaryTable
                    rows={pageRows}
                    sort={sort.by}
                    dir={sort.dir}
                    onSort={(by) => setSort((s) => ({ by, dir: s.by === by && s.dir === "asc" ? "desc" : "asc" }))}
                    onOpen={(row) => setDetail(preview.lines.find((l) => l.employeeId === row.employeeId) ?? null)}
                  />
                  <Pagination
                    page={current}
                    pageSize={pageSize}
                    totalRecords={rows.length}
                    totalPages={totalPages}
                    pageSizes={PAGE_SIZES}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                    noun="employees"
                  />
                </>
              )}
            </section>
          </>
        )}
      </div>

      <SalaryDetailDialog open={detail !== null} month={`${year}-${month}`} line={detail} onClose={() => setDetail(null)} />
      <ActionDialog open={confirmSubmit} title="Submit for approval" confirmLabel="Submit for Approval" busy={busy === "submit"} onConfirm={() => void save(true)} onClose={() => setConfirmSubmit(false)}>
        {preview && (
          <p>
            Save and submit {preview.officeName}&rsquo;s payroll for {period}: {preview.totals.employees} employees, net payable BDT {bdt(preview.totals.net)}
            {preview.warningCount > 0 ? `, with ${preview.warningCount} remark(s)` : ""}? The figures are locked while it is under processing, and it is approved only after the last approval stage.
          </p>
        )}
      </ActionDialog>
    </PageContainer>
  );
}
