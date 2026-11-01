"use client";

import { Copy, Eye, FileDown, FileSpreadsheet, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import type { Column } from "@/components/ui/data-table";
import { ListTable } from "@/features/production/components/ListTable";
import { CheckboxField, SelectField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { EmptyState } from "@/features/production/components/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { Switch } from "@/features/production/work-centers/components/WorkCenterParts";
import { paths } from "../../paths";
import type { BomListQuery, BomRow, BomRowOutput } from "../schemas/bom.schema";
import { downloadBomList, fetchBomLookups, fetchBoms, setBomActive } from "../services/bom.api";
import { BomDetailsDialog, CopyBomDialog, TagChildDialog, money, qty } from "./BomDialogs";

/** One table row: a BOM, or (with Details) one production item of a BOM. */
interface ListRow {
  key: string;
  bom: BomRow;
  output?: BomRowOutput;
  /** Production items not shown on this row (summary view). */
  more: number;
}

/** DD-MM-YYYY in Bangladesh time. */
function day(iso: string) {
  const [year, month, date] = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).split("-");
  return `${date}-${month}-${year}`;
}

/** /production/bill-of-materials: Managerium's Bill Of Material list. */
export function BomListView() {
  const toast = useToast();
  const router = useRouter();
  const lookups = useResource("bom-lookups", fetchBomLookups);
  const [filters, setFilters] = useState({ departmentId: "", departmentSectionId: "", status: "ACTIVE", details: false });
  const toQuery = (values: typeof filters): BomListQuery =>
    Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== "details" && value)) as BomListQuery;
  const [query, setQuery] = useState<BomListQuery>(toQuery(filters));
  const [details, setDetails] = useState(false);
  const list = useResource(`boms:${JSON.stringify(query)}`, () => fetchBoms(query));
  const [viewing, setViewing] = useState<string | null>(null);
  const [tagging, setTagging] = useState<BomRow | null>(null);
  const [copying, setCopying] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    setDetails(filters.details);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  /** Optimistic: flips the switch at once and puts it back if the save fails. */
  async function toggle(bom: BomRow, isActive: boolean) {
    setToggling(bom.id);
    list.mutate((rows) => (rows ?? []).map((row) => (row.id === bom.id ? { ...row, isActive } : row)));
    try {
      const updated = await setBomActive(bom.id, bom.updatedAt, isActive);
      list.mutate((rows) => (rows ?? []).map((row) => (row.id === updated.id ? updated : row)));
      toast.success(`${bom.name} is now ${isActive ? "active" : "inactive"}.`);
    } catch (error) {
      list.mutate((rows) => (rows ?? []).map((row) => (row.id === bom.id ? bom : row)));
      toast.error(errorMessage(error));
    } finally {
      setToggling(null);
    }
  }

  async function exportList(format: "xlsx" | "pdf") {
    setExporting(format);
    try {
      await downloadBomList(format, query, details);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(null);
    }
  }

  const boms = list.data;
  const rows = useMemo<ListRow[]>(
    () =>
      (boms ?? []).flatMap((bom) =>
        details && bom.outputs.length > 1
          ? bom.outputs.map((output) => ({ key: `${bom.id}:${output.itemId}`, bom, output, more: 0 }))
          : [{ key: bom.id, bom, output: bom.outputs[0], more: Math.max(bom.outputs.length - 1, 0) }],
      ),
    [boms, details],
  );

  const options = lookups.data;
  const sections = (options?.sections ?? []).filter((section) => !filters.departmentId || section.departmentId === filters.departmentId);

  const columns: Column<ListRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => index + 1, className: "w-10 tabular-nums" },
    {
      id: "action",
      header: "Action",
      className: "w-28",
      cell: ({ bom }) => (
        <span className="flex items-center gap-1">
          <Switch checked={bom.isActive} label={`${bom.name} active`} disabled={toggling === bom.id} onChange={(checked) => toggle(bom, checked)} />
          <Button size="icon" variant="ghost" aria-label={`View ${bom.name}`} title="View" onClick={() => setViewing(bom.id)}>
            <Eye aria-hidden="true" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Tag child BOM to ${bom.name}`} title="Tag Child BOM" onClick={() => setTagging(bom)}>
            <Plus aria-hidden="true" />
          </Button>
        </span>
      ),
    },
    { id: "date", header: "Date", cell: ({ bom }) => <span className="whitespace-nowrap">{day(bom.createdAt)}</span>, sortValue: ({ bom }) => bom.createdAt },
    {
      id: "name",
      header: "BOM Name",
      cell: ({ bom }) => (
        <span className="flex items-center gap-1.5">
          <Link href={paths.editBom(bom.id)} className="font-semibold text-ink hover:underline">
            {bom.name}
          </Link>
          {bom.childCount > 0 && <span className="text-xs text-ink-faint">({bom.childCount} child BOM)</span>}
        </span>
      ),
      sortValue: ({ bom }) => bom.name,
    },
    {
      id: "item",
      header: "Item Name",
      cell: ({ output, more }) =>
        output ? (
          <span>
            {output.code} - {output.name}
            {more > 0 && <span className="ml-1 text-xs text-ink-faint">(+{more} more)</span>}
          </span>
        ) : (
          "—"
        ),
      sortValue: ({ output }) => output?.name ?? "",
    },
    { id: "department", header: "Department", cell: ({ bom }) => bom.departmentName ?? "—", sortValue: ({ bom }) => bom.departmentName ?? "", hideBelow: "md" },
    { id: "section", header: "Section", cell: ({ bom }) => bom.sectionName ?? "—", sortValue: ({ bom }) => bom.sectionName ?? "", hideBelow: "md" },
    { id: "uom", header: "UoM", cell: ({ output }) => output?.uom ?? "—" },
    { id: "altUom", header: "Alt. UoM", cell: ({ output }) => output?.altUom ?? "—", hideBelow: "lg" },
    {
      id: "lot",
      header: "Lot Size",
      cell: ({ bom, output }) => qty(details && output && bom.outputs.length > 1 ? output.lotSizeQty : bom.lotSize),
      sortValue: ({ bom }) => bom.lotSize,
      className: "text-right tabular-nums",
    },
    {
      id: "tolerance",
      header: "Tolerance",
      cell: ({ bom }) => (bom.tolerancePercent === null ? "—" : `${qty(bom.tolerancePercent)}%`),
      className: "text-right tabular-nums",
      hideBelow: "lg",
    },
    {
      id: "value",
      header: "BOM Value",
      cell: ({ bom }) => <span className="font-medium text-ink">{money(bom.totalCost)}</span>,
      sortValue: ({ bom }) => bom.totalCost,
      className: "text-right tabular-nums",
    },
    { id: "createdBy", header: "Created By", cell: ({ bom }) => bom.createdByName, sortValue: ({ bom }) => bom.createdByName, hideBelow: "md" },
  ];

  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Bill Of Material"
        actions={
          <>
            <Button onClick={() => setCopying(true)} disabled={!boms?.length}>
              <Copy aria-hidden="true" />
              Copy Bill Of Material
            </Button>
            <Link href={paths.newBom} className={buttonClasses("primary")}>
              <Plus aria-hidden="true" />
              Bill Of Material
            </Link>
          </>
        }
      />
      <Card>
        <form onSubmit={view} className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <SelectField
            label="Department"
            value={filters.departmentId}
            options={[{ value: "", label: "All" }, ...(options?.departments ?? []).map((department) => ({ value: department.id, label: department.name }))]}
            onChange={(event) => setFilters({ ...filters, departmentId: event.target.value, departmentSectionId: "" })}
          />
          <SelectField
            label="Section"
            value={filters.departmentSectionId}
            options={[{ value: "", label: "All" }, ...sections.map((section) => ({ value: section.id, label: section.name }))]}
            onChange={(event) => setFilters({ ...filters, departmentSectionId: event.target.value })}
          />
          <SelectField
            label="Status"
            value={filters.status}
            options={[
              { value: "", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          />
          <CheckboxField
            label="Details"
            hint="One row per production item"
            checked={filters.details}
            onChange={(event) => setFilters({ ...filters, details: event.target.checked })}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={list.loading}>
              <RefreshCw aria-hidden="true" />
              View
            </Button>
            <Button onClick={() => exportList("xlsx")} loading={exporting === "xlsx"} disabled={!boms?.length || exporting !== null}>
              <FileSpreadsheet aria-hidden="true" />
              Excel
            </Button>
            <Button onClick={() => exportList("pdf")} loading={exporting === "pdf"} disabled={!boms?.length || exporting !== null}>
              <FileDown aria-hidden="true" />
              PDF
            </Button>
          </div>
        </form>
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
        ) : !boms ? (
          <LoadingState label="Loading bills of material…" />
        ) : (
          <div className={list.loading ? "opacity-60 transition-opacity" : undefined} aria-busy={list.loading}>
            <ListTable
              rows={rows}
              columns={columns}
              getRowId={(row) => row.key}
              getRowLabel={(row) => row.bom.name}
              search={{
                placeholder: "Search…",
                match: ({ bom, output }, needle) =>
                  [bom.name, output?.code, output?.name, bom.departmentName, bom.sectionName, bom.createdByName].some((value) => value?.toLowerCase().includes(needle)),
              }}
              bulkActions={(selected, clear) => [
                {
                  label: "Copy Bill Of Material",
                  onSelect: () => {
                    if (selected.length !== 1) return toast.error("Choose exactly one BOM to copy.");
                    clear();
                    router.push(paths.copyBom(selected[0].bom.id));
                  },
                },
              ]}
              footer={(shown) => {
                const counted = new Map(shown.map((row) => [row.bom.id, row.bom.totalCost]));
                return { name: "Total", value: money([...counted.values()].reduce((sum, value) => sum + value, 0)) };
              }}
              emptyState={
                <EmptyState title="No bill of material yet">
                  <Link href={paths.newBom} className={buttonClasses("primary", "sm", "mt-2")}>
                    <Plus aria-hidden="true" />
                    Bill Of Material
                  </Link>
                </EmptyState>
              }
            />
          </div>
        )}
      </Card>
      <BomDetailsDialog id={viewing} onClose={() => setViewing(null)} />
      <TagChildDialog bom={tagging} onClose={() => setTagging(null)} onSaved={list.reload} />
      <CopyBomDialog
        open={copying}
        rows={boms ?? []}
        onClose={() => setCopying(false)}
        onCopy={(id) => {
          setCopying(false);
          router.push(paths.copyBom(id));
        }}
      />
    </PageContainer>
  );
}
