"use client";

import { Download, Search, Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { entityMasterDataBreadcrumbs } from "../../breadcrumbs";
import { entityMasterDataPaths } from "../../paths";
import type { EmployeeActionDefinition, EmployeeActionTarget } from "../actions/employee-actions";
import {
  DEFAULT_EMPLOYEE_PAGE_SIZE,
  EMPLOYEE_EXPORT_PAGE_SIZE,
  EMPLOYEE_PAGE_SIZES,
  USER_ROLE_LABELS,
  type EmployeeList,
  type EmployeeListParams,
  type EmployeeListRow,
} from "../schemas/employee.schema";
import { employeeApi, employeeListSearch } from "../services/employee.api";
import { EmployeeActionPanel, type OpenEmployeeAction } from "./EmployeeActionPanel";
import { EmployeeDetailPanel } from "./EmployeeDetailPanel";
import { EmployeeProfileDialog } from "./EmployeeProfileDialog";
import { EmployeeTable } from "./EmployeeTable";
import { EmployeeStatusTabs, EmployeeToolbar, type EmployeeFilters } from "./EmployeeToolbar";
import { EmptyBlock } from "./kit";
import { BulkUploadDialog } from "../../components/BulkUploadDialog";

interface AppliedQuery {
  search: string;
  filters: EmployeeFilters;
}

/** Order-independent key of a search + filters, "" when nothing is set. */
function queryKey({ search, filters }: AppliedQuery): string {
  const params = new URLSearchParams(employeeListSearch({ search, ...filters }));
  params.sort();
  return params.toString();
}

const BREADCRUMBS = entityMasterDataBreadcrumbs(entityMasterDataPaths.employee);

// ─── CSV export ──────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Employee Code", "Attendance ID", "Name", "Designation", "Department",
  "Office", "Joining Date", "Termination Date", "Mobile", "Employee Type",
  "User Role", "Status", "Last Action By", "Last Action At",
];

function rowToCsv(row: EmployeeListRow): string {
  const cells = [
    row.employeeCode,
    row.attendanceId ?? "",
    row.name,
    row.designation ?? "",
    row.department ?? "",
    row.officeName,
    row.joiningDate,
    row.terminationDate ?? "",
    row.mobile ?? "",
    row.employeeType ?? "",
    row.userRole ? USER_ROLE_LABELS[row.userRole] : "",
    row.isActive ? "Active" : "Inactive",
    row.lastActionBy ?? "",
    row.lastActionAt,
  ];
  return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
}

function downloadCsv(rows: EmployeeListRow[]) {
  const lines = [CSV_HEADERS.join(","), ...rows.map(rowToCsv)];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `employees_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EmployeeListView() {
  const toast = useToast();
  // What is typed/selected (draft) and what the list was last loaded with (applied):
  // the list is only queried when the user clicks View, not on every change.
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<EmployeeFilters>({});
  const [applied, setApplied] = useState<AppliedQuery>({ search: "", filters: {} });
  const [pageSize, setPageSize] = useState<number>(DEFAULT_EMPLOYEE_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [openAction, setOpenAction] = useState<OpenEmployeeAction | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<EmployeeListRow | null>(null);
  const [profileTarget, setProfileTarget] = useState<EmployeeActionTarget | null>(null);
  const [exporting, setExporting] = useState(false);

  const params: EmployeeListParams = { page, pageSize, search: applied.search, ...applied.filters };
  const list = useResource(`employees?${employeeListSearch(params)}`, () => employeeApi.list(params));
  const [uploadOpen, setUploadOpen] = useState(false);
  const options = useResource("employee-filter-options", employeeApi.filterOptions);

  // Keep the last page on screen while the next one loads (no flashing).
  const [shown, setShown] = useState<EmployeeList>();
  if (list.data && list.data !== shown) setShown(list.data);

  const goToPage = setPage;
  /** Loads the list with the given search and filters (page 1). */
  const apply = (next: AppliedQuery) => {
    setApplied(next);
    setPage(1);
  };
  const changePageSize = (next: number) => {
    setPageSize(next);
    setPage(1);
  };
  const draft: AppliedQuery = { search: search.trim(), filters };
  const pending = queryKey(draft) !== queryKey(applied);
  const filtered = queryKey(applied) !== "" || queryKey(draft) !== "";
  const clearAll = () => {
    setSearch("");
    setFilters({});
    apply({ search: "", filters: {} });
  };

  const openEmployeeAction = (action: EmployeeActionDefinition, employee: EmployeeActionTarget) => {
    if (action.id === "profile-view") setProfileTarget(employee);
    else setOpenAction({ action, employee });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await employeeApi.list({
        page: 1,
        pageSize: EMPLOYEE_EXPORT_PAGE_SIZE,
        search: applied.search,
        ...applied.filters,
      });
      downloadCsv(result.rows);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const total = shown?.pagination.totalRecords;

  return (
    <PageContainer full>
      <PageHead
        title="Employees"
        subtitle="Search, filter and manage employee records."
        breadcrumbs={BREADCRUMBS}
        actions={
          <>
            <Button loading={exporting} onClick={handleExport} title="Download the filtered list as CSV">
              <Download /> Export
            </Button>
            <Button onClick={() => setUploadOpen(true)} title="Add many employees from an Excel file">
              <Upload /> Bulk Upload
            </Button>
            <Link href={entityMasterDataPaths.employeeCreate} className={buttonClasses("accent", "md")}>
              <UserPlus /> New Employee
            </Link>
          </>
        }
      />

      <section className="rounded border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <EmployeeStatusTabs
          status={applied.filters.status}
          onChange={(status) => {
            // A tab is a single deliberate click, so it loads at once (with the other filters as selected).
            const next = { ...filters, status };
            setFilters(next);
            apply({ search: search.trim(), filters: next });
          }}
          total={list.loading ? undefined : total}
        />
        <EmployeeToolbar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          onApply={() => apply(draft)}
          pending={pending}
          loading={list.loading}
          options={options.error ? undefined : options.data}
          onClear={filtered ? clearAll : undefined}
        />

        <div className="border-t border-line">
          {list.error ? (
            <ErrorState message={list.error.message} onRetry={list.reload} />
          ) : !shown ? (
            <LoadingState label="Loading employees…" />
          ) : shown.pagination.totalRecords === 0 ? (
            <div className={list.loading ? "p-5 opacity-60" : "p-5"}>
              {filtered ? (
                <EmptyBlock icon={<Search />} title="No matching employees">
                  <p>Try a different search or filter.</p>
                  <Button size="sm" className="mt-3" onClick={clearAll}>
                    Clear search &amp; filters
                  </Button>
                </EmptyBlock>
              ) : (
                <EmptyBlock icon={<UserPlus />} title="No employees yet">
                  <p>Add your first employee to get started.</p>
                  <Link href={entityMasterDataPaths.employeeCreate} className={buttonClasses("accent", "sm", "mt-3")}>
                    <UserPlus /> New Employee
                  </Link>
                </EmptyBlock>
              )}
            </div>
          ) : (
            <EmployeeTable
              rows={shown.rows}
              firstSerial={(shown.pagination.page - 1) * shown.pagination.pageSize + 1}
              busy={list.loading}
              onAction={openEmployeeAction}
              onRowClick={setDetailEmployee}
            />
          )}
        </div>

        {shown && shown.pagination.totalRecords > 0 && !list.error && (
          <div className="border-t border-line bg-canvas px-5 py-2.5">
            <Pagination
              page={shown.pagination.page}
              pageSize={pageSize}
              totalRecords={shown.pagination.totalRecords}
              totalPages={shown.pagination.totalPages}
              pageSizes={EMPLOYEE_PAGE_SIZES}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
              disabled={list.loading}
              noun="employees"
            />
          </div>
        )}
      </section>

      <EmployeeActionPanel current={openAction} onClose={() => setOpenAction(null)} />
      <EmployeeDetailPanel employee={detailEmployee} onClose={() => setDetailEmployee(null)} />
      <EmployeeProfileDialog employee={profileTarget} onClose={() => setProfileTarget(null)} />

      <BulkUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={() => {
          list.reload();
          options.reload();
        }}
        noun="employees"
        templateUrl={employeeApi.importTemplateUrl}
        maxRows={2000}
        matchHint="Office must match an office name; Employee ID must be new in that business unit."
        upload={employeeApi.importFile}
      />
    </PageContainer>
  );
}
