"use client";

import { Eye, Plus, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { apiRequest } from "@/lib/api/client";
import { resolveBreadcrumbs } from "@/lib/navigation/registry";
import { EmptyBlock, Input, Select, TABLE } from "@/features/configuration/entity-master-data/employee/components/kit";
import { Grid } from "../../self-service/leave-movement/components/shared";
import { hrmPaths } from "../../paths";
import { FilterField, MONTHS, OfficeSelect, YearSelect, currentPeriod, formatDate, monthLabel, useHrOptions } from "../../shared/hr-ui";
import { PAYROLL_STATUSES, type PayrollBatchList, type PayrollBatchRow } from "../batch-types";
import { PayrollStatusBadge, bdt } from "./payroll-ui";

const HEADERS = ["SL", "Action", "Payroll Ref.", "Office", "Month", "Year", "Payroll Date", "Employees", "Gross Salary", "Deductions", "Net Payable", "Status", "Approval Stage"];
const PAGE_SIZES = [20, 50, 100] as const;

function approvalStage(row: PayrollBatchRow) {
  if (row.status === "Under Processing") return row.approval.current ? `Stage ${row.approval.current.stageNo} of ${row.approval.stages}: ${row.approval.current.name}` : "Waiting for approval";
  if (row.status === "Approved") return row.approval.stages > 0 ? `All ${row.approval.stages} stages approved` : "Approved";
  if (row.status === "Rejected") return "Returned for correction";
  return "—";
}

export function PayrollView() {
  const options = useHrOptions();
  const [filter, setFilter] = useState({ officeId: "", status: "", ...currentPeriod() });
  const [applied, setApplied] = useState(filter);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  // Search applies shortly after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const query = new URLSearchParams({ year: applied.year, page: String(page), pageSize: String(pageSize) });
  if (applied.month) query.set("month", applied.month);
  if (applied.officeId) query.set("officeId", applied.officeId);
  if (applied.status) query.set("status", applied.status);
  if (search) query.set("search", search);
  const list = useResource(`hrm-payroll-batches?${query}`, () => apiRequest<PayrollBatchList>(`/api/hrm/payroll/batches?${query}`), { refreshOnFocus: true });

  // Keep the last page of rows on screen while the next one loads.
  const [shown, setShown] = useState<PayrollBatchList | null>(null);
  if (list.data && list.data !== shown) setShown(list.data);
  const data = list.data ?? shown;

  const generateHref = `${hrmPaths.payrollGenerate}?${new URLSearchParams({ officeId: applied.officeId, month: applied.month || currentPeriod().month, year: applied.year })}`;

  function view(event: FormEvent) {
    event.preventDefault();
    setApplied(filter);
    setPage(1);
  }

  return (
    <PageContainer full>
      <PageHead title="Payroll" subtitle="Salary batches by office and month. A batch is paid only after its last approval stage." breadcrumbs={resolveBreadcrumbs(hrmPaths.payroll).slice(1)} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded border border-line bg-surface px-4 py-3 shadow-xs">
          <form role="search" aria-label="Payroll filters" className="flex flex-wrap items-end gap-3" onSubmit={view}>
            <FilterField label="Office" width="w-60">
              {(id) => <OfficeSelect id={id} options={options.data} value={filter.officeId} onChange={(officeId) => setFilter((f) => ({ ...f, officeId }))} />}
            </FilterField>
            <FilterField label="Month" width="w-36">
              {(id) => (
                <Select id={id} value={filter.month} onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))} placeholder="All months" options={MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }))} />
              )}
            </FilterField>
            <FilterField label="Year" width="w-24">
              {(id) => <YearSelect id={id} value={filter.year} onChange={(year) => setFilter((f) => ({ ...f, year }))} />}
            </FilterField>
            <FilterField label="Status" width="w-40">
              {(id) => <Select id={id} value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} placeholder="All statuses" options={PAYROLL_STATUSES} />}
            </FilterField>
            <Button type="submit" variant="primary" loading={list.loading && !!data}>
              <Eye aria-hidden="true" />
              View
            </Button>
          </form>
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative w-64 max-w-full">
              <label htmlFor="payroll-search" className="sr-only">
                Search by employee name, employee code or payroll reference
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
              <Input id="payroll-search" type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Employee, code or payroll ref." className="pl-8" autoComplete="off" />
            </div>
            <Link href={generateHref} className={buttonClasses("primary", "md")}>
              <Plus aria-hidden="true" />
              Salary Generate
            </Link>
          </div>
        </div>

        <section className="rounded border border-line bg-surface p-4 shadow-xs">
          {list.error && !data ? (
            <ErrorState message={list.error.message} onRetry={list.reload} />
          ) : !data ? (
            <LoadingState label="Loading payrolls…" />
          ) : data.rows.length === 0 ? (
            <EmptyBlock icon={<Wallet />} title={search || applied.status || applied.officeId ? "No payroll matches these filters" : `No payroll for ${applied.month ? monthLabel(`${applied.year}-${applied.month}`) : applied.year} yet`}>
              <Link href={generateHref} className={buttonClasses("accent-soft", "md")}>
                <Plus aria-hidden="true" />
                Salary Generate
              </Link>
            </EmptyBlock>
          ) : (
            <div className="flex flex-col gap-3">
              {list.error && <ErrorState message={list.error.message} onRetry={list.reload} />}
              <Grid headers={HEADERS} loading={list.loading}>
                {data.rows.map((row, index) => (
                  <tr key={row.id} className={TABLE.row}>
                    <td className={`${TABLE.td} text-right text-ink-faint tabular-nums`}>{(data.page - 1) * data.pageSize + index + 1}</td>
                    <td className={`${TABLE.td} px-1 py-1 text-center`}>
                      <Link href={hrmPaths.payrollBatch(row.id)} className={buttonClasses("ghost", "icon", "hover:text-accent-strong")} title="Open payroll" aria-label={`Open payroll ${row.reference}`}>
                        <Eye />
                      </Link>
                    </td>
                    <td className={`${TABLE.td} whitespace-nowrap`}>
                      <Link href={hrmPaths.payrollBatch(row.id)} className="font-mono text-xs font-semibold text-accent-strong hover:underline dark:text-accent">
                        {row.reference}
                      </Link>
                    </td>
                    <td className={`${TABLE.td} whitespace-nowrap`} title={row.businessUnit}>
                      {row.officeName}
                    </td>
                    <td className={`${TABLE.td} whitespace-nowrap`}>{MONTHS[Number(row.month.slice(5)) - 1]}</td>
                    <td className={`${TABLE.td} tabular-nums`}>{row.month.slice(0, 4)}</td>
                    <td className={`${TABLE.td} whitespace-nowrap tabular-nums`}>{formatDate(row.payrollDate)}</td>
                    <td className={`${TABLE.td} text-right tabular-nums`}>{row.employeeCount}</td>
                    <td className={`${TABLE.td} text-right tabular-nums`}>{bdt(row.totalGross)}</td>
                    <td className={`${TABLE.td} text-right tabular-nums`}>{bdt(row.totalDeduction)}</td>
                    <td className={`${TABLE.td} text-right font-semibold tabular-nums`}>{bdt(row.totalNet)}</td>
                    <td className={TABLE.td}>
                      <PayrollStatusBadge status={row.status} />
                    </td>
                    <td className={`${TABLE.td} whitespace-nowrap text-ink-muted`}>{approvalStage(row)}</td>
                  </tr>
                ))}
              </Grid>
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                totalRecords={data.total}
                totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
                pageSizes={PAGE_SIZES}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                disabled={list.loading}
                noun="payrolls"
              />
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
