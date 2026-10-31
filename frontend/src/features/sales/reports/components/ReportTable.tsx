"use client";

import { useEffect } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/features/sales/components/EmptyState";
import { cn } from "@/lib/cn";
import { formatAmount, formatQty } from "../../dashboard/lib/format";
import type { ExportTable } from "../../lib/export-table";
import { formatDay } from "../../lib/use-today";
import type { ReportCell, ReportColumn, ReportResult } from "../schemas/report.schema";

/** A report row; its position is the table row id. */
type KeyedRow = Record<string, ReportCell>;

export function formatCell(value: ReportCell, kind: ReportColumn["kind"]) {
  if (value === null || value === "") return "—";
  if (typeof value === "string") return kind === "date" ? formatDay(value) : value;
  switch (kind) {
    case "amount":
      return formatAmount(value);
    case "qty":
      return formatQty(value);
    case "percent":
      return `${value.toFixed(2)}%`;
    default:
      return value.toLocaleString("en-US");
  }
}

const numeric = (kind: ReportColumn["kind"]) => kind === "amount" || kind === "qty" || kind === "number" || kind === "percent";

/** Header and rows (with SL) for Excel and PDF. */
export function reportExport(data: ReportResult): { headers: string[]; rows: (string | number | null)[][] } {
  return {
    headers: ["SL", ...data.columns.map((column) => column.label)],
    rows: data.rows.map((row, index) => [index + 1, ...data.columns.map((column) => (row[column.key] === null ? "" : row[column.key]))]),
  };
}

/** Hands the table on screen to the page head (Excel / PDF), and clears it when the tab closes. */
export function useReportExport(table: ExportTable | null, onExport: (table: ExportTable | null) => void) {
  const key = table ? JSON.stringify(table) : "";
  useEffect(() => {
    onExport(key ? (JSON.parse(key) as ExportTable) : null);
  }, [key, onExport]);
  useEffect(() => () => onExport(null), [onExport]);
}

/** A report's rows with SL, sorting, search and a total row. */
export function ReportTable({ data }: { data: ReportResult }) {
  const columns: Column<KeyedRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => <span className="text-ink-faint tabular-nums">{index + 1}</span>, className: "w-10" },
    ...data.columns.map((column) => ({
      id: column.key,
      header: column.label,
      cell: (row: KeyedRow) => {
        const value = row[column.key];
        return (
          <span className={cn(numeric(column.kind) && "tabular-nums", typeof value === "number" && value < 0 && "text-danger", column.kind === "date" && "whitespace-nowrap")}>
            {formatCell(value, column.kind)}
          </span>
        );
      },
      sortValue: (row: KeyedRow) => {
        const value = row[column.key];
        return typeof value === "number" ? value : String(value ?? "");
      },
      className: numeric(column.kind) ? "text-right" : undefined,
    })),
  ];

  return (
    <DataTable
      rows={data.rows.map((row, index): KeyedRow => ({ ...row, __key: String(index) }))}
      columns={columns}
      getRowId={(row) => String(row.__key)}
      getRowLabel={(row) => String(row[data.columns[0].key] ?? row.__key)}
      search={{
        placeholder: "Search this report",
        match: (row, needle) =>
          data.columns
            .filter((column) => !numeric(column.kind))
            .some((column) => String(row[column.key] ?? "").toLowerCase().includes(needle)),
      }}
      footer={(shown) => {
        const totals: Record<string, string> = {};
        const label = data.columns.find((column) => !numeric(column.kind) && column.kind !== "date")?.key;
        if (label) totals[label] = "Total:";
        for (const column of data.columns.filter((candidate) => candidate.total)) {
          const total = shown.reduce((sum, row) => sum + (typeof row[column.key] === "number" ? (row[column.key] as number) : 0), 0);
          totals[column.key] = formatCell(Math.round(total * 1000) / 1000, column.kind) as string;
        }
        return totals;
      }}
      emptyState={<EmptyState title="No data for these filters" />}
    />
  );
}
