"use client";

import { Download, Eye, Pencil, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import type { Column } from "@/components/ui/data-table";
import { ListTable } from "@/features/production/components/ListTable";
import { SelectField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { EmptyState } from "@/features/production/components/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { formatQty } from "@/features/sales/dashboard/lib/format";
import { paths } from "../../paths";
import type { WorkCenterListQuery, WorkCenterRow } from "../schemas/work-center.schema";
import { downloadWorkCenters, fetchWorkCenterLookups, fetchWorkCenters, setWorkCenterActive } from "../services/work-center.api";
import { Switch, WorkCenterDetailsDialog } from "./WorkCenterParts";

const dash = (value: string | null) => value ?? "—";

/** /production/work-centers: Managerium's Work Center list. */
export function WorkCenterListView() {
  const toast = useToast();
  const lookups = useResource("work-center-lookups", fetchWorkCenterLookups);
  const [filters, setFilters] = useState({ typeId: "", departmentId: "", departmentSectionId: "" });
  const toQuery = (values: typeof filters): WorkCenterListQuery =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value)) as WorkCenterListQuery;
  const [query, setQuery] = useState<WorkCenterListQuery>({});
  const list = useResource(`work-centers:${JSON.stringify(query)}`, () => fetchWorkCenters(query));
  const [viewing, setViewing] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  async function toggle(row: WorkCenterRow, isActive: boolean) {
    setToggling(row.id);
    try {
      const updated = await setWorkCenterActive(row.id, row.updatedAt, isActive);
      list.mutate((rows) => (rows ?? []).map((item) => (item.id === updated.id ? updated : item)));
      toast.success(`${row.name} is now ${isActive ? "active" : "inactive"}.`);
    } catch (error) {
      toast.error(errorMessage(error));
      list.reload();
    } finally {
      setToggling(null);
    }
  }

  const rows = list.data;
  /** Excel (.xlsx) of the list as last viewed. */
  async function exportExcel() {
    setExporting(true);
    try {
      await downloadWorkCenters(query);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  const options = lookups.data;
  const sections = (options?.sections ?? []).filter((section) => !filters.departmentId || section.departmentId === filters.departmentId);

  const columns: Column<WorkCenterRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => index + 1, className: "w-12 tabular-nums" },
    {
      id: "action",
      header: "Action",
      className: "w-28",
      cell: (row) => (
        <span className="flex items-center gap-1">
          <Link href={paths.editWorkCenter(row.id)} aria-label={`Edit ${row.name}`} title="Edit" className={buttonClasses("ghost", "icon")}>
            <Pencil aria-hidden="true" />
          </Link>
          <Button size="icon" variant="ghost" aria-label={`View ${row.name}`} title="View" onClick={() => setViewing(row.id)}>
            <Eye aria-hidden="true" />
          </Button>
          <Switch checked={row.isActive} label={`${row.name} active`} disabled={toggling === row.id} onChange={(checked) => toggle(row, checked)} />
        </span>
      ),
    },
    { id: "department", header: "Department", cell: (row) => dash(row.departmentName), sortValue: (row) => row.departmentName ?? "" },
    { id: "section", header: "Department Section", cell: (row) => dash(row.sectionName), sortValue: (row) => row.sectionName ?? "" },
    { id: "code", header: "Work Center Code", cell: (row) => <span className="font-medium text-ink">{row.code}</span>, sortValue: (row) => row.code },
    { id: "type", header: "Work Center Type", cell: (row) => row.typeName, sortValue: (row) => row.typeName },
    {
      id: "name",
      header: "Work Center",
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          <span className="text-ink">{row.name}</span>
          {!row.isActive && <span className="text-xs text-danger">(Inactive)</span>}
        </span>
      ),
      sortValue: (row) => row.name,
    },
    { id: "runHour", header: "Standard Run Hour", cell: (row) => formatQty(row.standardRunHour), sortValue: (row) => row.standardRunHour, className: "tabular-nums" },
    { id: "capacity", header: "Capacity Per Hour", cell: (row) => formatQty(row.capacityPerHour), sortValue: (row) => row.capacityPerHour, className: "tabular-nums" },
    { id: "rated", header: "Rated Capacity Per Hour", cell: (row) => formatQty(row.ratedCapacityPerHour), sortValue: (row) => row.ratedCapacityPerHour, className: "tabular-nums" },
    { id: "operators", header: "Operator Tagging", cell: (row) => row.operatorCount, sortValue: (row) => row.operatorCount, className: "text-center tabular-nums" },
  ];

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Work Center"
        actions={
          <>
            <Button onClick={exportExcel} loading={exporting} disabled={!rows?.length}>
              <Download aria-hidden="true" />
              Excel
            </Button>
            <Link href={paths.newWorkCenter} className={buttonClasses("primary")}>
              <Plus aria-hidden="true" />
              New Work Center
            </Link>
          </>
        }
      />
      <Card>
        <form onSubmit={view} className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <SelectField
            label="Work Center Type"
            value={filters.typeId}
            options={[{ value: "", label: "All" }, ...(options?.types ?? []).map((type) => ({ value: type.id, label: type.name }))]}
            onChange={(event) => setFilters({ ...filters, typeId: event.target.value })}
          />
          <SelectField
            label="Department"
            value={filters.departmentId}
            options={[{ value: "", label: "All" }, ...(options?.departments ?? []).map((department) => ({ value: department.id, label: department.name }))]}
            onChange={(event) => setFilters({ ...filters, departmentId: event.target.value, departmentSectionId: "" })}
          />
          <SelectField
            label="Department Section"
            value={filters.departmentSectionId}
            options={[{ value: "", label: "All" }, ...sections.map((section) => ({ value: section.id, label: section.name }))]}
            onChange={(event) => setFilters({ ...filters, departmentSectionId: event.target.value })}
          />
          <Button type="submit" variant="primary" disabled={list.loading}>
            <RefreshCw aria-hidden="true" />
            View
          </Button>
        </form>
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : !rows ? (
          <LoadingState label="Loading work centers…" />
        ) : (
          <div className={list.loading ? "opacity-60 transition-opacity" : undefined} aria-busy={list.loading}>
            <ListTable
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => `${row.code} ${row.name}`}
              search={{
                placeholder: "Search…",
                match: (row, needle) =>
                  [row.code, row.name, row.typeName, row.departmentName, row.sectionName, row.warehouseName]
                    .some((value) => value?.toLowerCase().includes(needle)),
              }}
              emptyState={
                <EmptyState title="No work center yet">
                  <Link href={paths.newWorkCenter} className={buttonClasses("primary", "sm", "mt-2")}>
                    <Plus aria-hidden="true" />
                    New Work Center
                  </Link>
                </EmptyState>
              }
            />
          </div>
        )}
      </Card>
      <WorkCenterDetailsDialog id={viewing} onClose={() => setViewing(null)} />
    </PageContainer>
  );
}
