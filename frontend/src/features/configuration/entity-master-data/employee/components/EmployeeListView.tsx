"use client";

import { Download, Search, Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

const SEARCH_DEBOUNCE_MS = 300;
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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [filters, setFilters] = useState<EmployeeFilters>({});
  const [pageSize, setPageSize] = useState<number>(DEFAULT_EMPLOYEE_PAGE_SIZE);
  // The requested page belongs to the search it was chosen for, so a new search
  // starts on page 1 without an extra request.
  const [paging, setPaging] = useState({ page: 1, search: "" });
  const page = paging.search === debouncedSearch ? paging.page : 1;
  const [openAction, setOpenAction] = useState<OpenEmployeeAction | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<EmployeeListRow | null>(null);
  const [profileTarget, setProfileTarget] = useState<EmployeeActionTarget | null>(null);
  const [exporting, setExporting] = useState(false);

  const params: EmployeeListParams = { page, pageSize, search: debouncedSearch, ...filters };
  const list = useResource(`employees?${employeeListSearch(params)}`, () => employeeApi.list(params));
  const options = useResource("employee-filter-options", employeeApi.filterOptions);

  // Keep the last page on screen while the next one loads (no flashing).
  const [shown, setShown] = useState<EmployeeList>();
  if (list.data && list.data !== shown) setShown(list.data);

  const goToPage = (next: number) => setPaging({ page: next, search: debouncedSearch });
  const changeFilters = (next: EmployeeFilters) => {
    setFilters(next);
    goToPage(1);
  };
  const changePageSize = (next: number) => {
    setPageSize(next);
    goToPage(1);
  };
  const filtered = search.trim() !== "" || Object.values(filters).some((v) => v !== undefined);
  const clearAll = () => {
    setSearch("");
    changeFilters({});
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
        search: debouncedSearch,
        ...filters,
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
            <Button disabled title="Bulk import is not available yet">
              <Upload /> Bulk Import
            </Button>
            <Link href={entityMasterDataPaths.employeeCreate} className={buttonClasses("accent", "md")}>
              <UserPlus /> New Employee
            </Link>
          </>
        }
      />

      <section className="rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <EmployeeStatusTabs
          status={filters.status}
          onChange={(status) => changeFilters({ ...filters, status })}
          total={list.loading ? undefined : total}
        />
        <EmployeeToolbar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={changeFilters}
          userTypes={options.error ? [] : options.data?.employeeTypes}
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
    </PageContainer>
  );
}
