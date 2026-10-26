"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatCompanyDate, formatCompanyDateTime } from "@/lib/format";
import type { EmployeeActionDefinition, EmployeeActionTarget } from "../actions/employee-actions";
import { USER_ROLE_LABELS, type EmployeeListRow } from "../schemas/employee.schema";
import { EmployeeActionMenu } from "./EmployeeActionMenu";
import { Avatar, StatusBadge } from "./kit";

const NONE = <span className="text-ink-faint">—</span>;

interface Column {
  id: string;
  header: string;
  cell: (row: EmployeeListRow, onOpen: (row: EmployeeListRow) => void) => ReactNode;
  className?: string;
}

/** Columns after SL and Action, in the required order. */
const COLUMNS: readonly Column[] = [
  { id: "employeeCode", header: "Employee Id", cell: (row) => row.employeeCode, className: "font-medium text-ink tabular-nums" },
  { id: "attendanceId", header: "Attendance Id", cell: (row) => row.attendanceId ?? NONE, className: "tabular-nums" },
  {
    id: "name",
    header: "Employee Name",
    cell: (row, onOpen) => (
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="group flex items-center gap-2.5 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Avatar name={row.name} size="sm" />
        <span className="font-medium text-ink group-hover:text-accent-strong group-hover:underline dark:group-hover:text-accent">
          {row.name}
        </span>
      </button>
    ),
  },
  { id: "designation", header: "Designation", cell: (row) => row.designation ?? NONE },
  { id: "department", header: "Department", cell: (row) => row.department ?? NONE },
  { id: "office", header: "Office Name", cell: (row) => row.officeName },
  {
    id: "joiningDate",
    header: "Joining Date",
    cell: (row) => <time dateTime={row.joiningDate}>{formatCompanyDate(row.joiningDate, row.dateFormat)}</time>,
    className: "tabular-nums",
  },
  {
    id: "terminationDate",
    header: "Termination Date",
    cell: (row) =>
      row.terminationDate ? (
        <time dateTime={row.terminationDate}>{formatCompanyDate(row.terminationDate, row.dateFormat)}</time>
      ) : (
        NONE
      ),
    className: "tabular-nums",
  },
  { id: "mobile", header: "Mobile/User", cell: (row) => row.mobile ?? NONE, className: "tabular-nums" },
  { id: "type", header: "Type", cell: (row) => row.employeeType ?? NONE },
  { id: "userRole", header: "User Role", cell: (row) => (row.userRole ? USER_ROLE_LABELS[row.userRole] : NONE) },
  { id: "lastActionBy", header: "Last Action By", cell: (row) => row.lastActionBy ?? NONE },
  {
    id: "lastActionAt",
    header: "Last Action Time",
    cell: (row) => <time dateTime={row.lastActionAt}>{formatCompanyDateTime(row.lastActionAt, row.dateFormat)}</time>,
    className: "tabular-nums",
  },
  { id: "status", header: "Status", cell: (row) => <StatusBadge active={row.isActive} /> },
];

export const EMPLOYEE_COLUMN_HEADERS = ["SL", "Action", ...COLUMNS.map((column) => column.header)];

interface EmployeeTableProps {
  rows: readonly EmployeeListRow[];
  /** Serial number of the first row (continuous across pages). */
  firstSerial: number;
  /** A newer page is loading; current rows stay visible but dimmed. */
  busy?: boolean;
  onAction: (action: EmployeeActionDefinition, employee: EmployeeActionTarget) => void;
  onRowClick: (row: EmployeeListRow) => void;
}

// Purchase-style grid: blue header band, borders on every cell (border-separate keeps them on sticky cells).
const TH =
  "sticky top-0 z-10 border-r border-b-2 border-r-grid-head-line border-b-grid-head-rule bg-grid-head px-2.5 py-2 text-left text-[11px] font-bold tracking-wide whitespace-nowrap text-grid-head-ink uppercase";
const TD = "border-r border-b border-grid-line px-2.5 py-2";
// SL and Action stay visible while scrolling sideways.
const PIN_SL = "sticky left-0 z-[1] w-12";
const PIN_ACTION = "sticky left-12 z-[1] w-56";

export function EmployeeTable({ rows, firstSerial, busy, onAction, onRowClick }: EmployeeTableProps) {
  return (
    <div
      className={cn("max-h-[min(70vh,52rem)] overflow-auto transition-opacity", busy && "opacity-60")}
      aria-busy={busy || undefined}
    >
      <table className="w-full min-w-max border-separate border-spacing-0 text-[12px]">
        <caption className="sr-only">Employees</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(TH, PIN_SL, "z-20 text-right")}>
              SL
            </th>
            <th scope="col" className={cn(TH, PIN_ACTION, "z-20 text-center")}>
              Action
            </th>
            {COLUMNS.map((column) => (
              <th key={column.id} scope="col" className={TH}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="group">
              <td
                className={cn(
                  PIN_SL,
                  TD,
                  "bg-surface text-right text-ink-faint tabular-nums group-hover:bg-grid-hover",
                )}
              >
                {firstSerial + index}
              </td>
              <td className={cn(PIN_ACTION, TD, "bg-surface px-1.5 py-1 group-hover:bg-grid-hover")}>
                <EmployeeActionMenu
                  employee={{ employeeId: row.id, employeeCode: row.employeeCode, name: row.name }}
                  onSelect={onAction}
                />
              </td>
              {COLUMNS.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    TD,
                    "whitespace-nowrap text-ink group-hover:bg-grid-hover",
                    column.className,
                  )}
                >
                  {column.cell(row, onRowClick)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
