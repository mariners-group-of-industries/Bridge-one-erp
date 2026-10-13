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

const TH = "sticky top-0 z-10 bg-canvas px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap text-ink-muted";
// SL and Action stay visible while scrolling sideways.
const PIN_SL = "sticky left-0 z-[1] w-12";
const PIN_ACTION = "sticky left-12 z-[1] w-56 border-r border-line";

export function EmployeeTable({ rows, firstSerial, busy, onAction, onRowClick }: EmployeeTableProps) {
  return (
    <div
      className={cn("max-h-[min(70vh,52rem)] overflow-auto transition-opacity", busy && "opacity-60")}
      aria-busy={busy || undefined}
    >
      <table className="w-full min-w-max text-sm">
        <caption className="sr-only">Employees</caption>
        <thead>
          <tr className="border-b border-line">
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
            <tr key={row.id} className="group border-b border-line last:border-b-0">
              <td
                className={cn(
                  PIN_SL,
                  "bg-surface px-3 py-2 text-right text-xs text-ink-faint tabular-nums group-hover:bg-accent-soft",
                )}
              >
                {firstSerial + index}
              </td>
              <td className={cn(PIN_ACTION, "bg-surface px-2 py-1 group-hover:bg-accent-soft")}>
                <EmployeeActionMenu
                  employee={{ employeeId: row.id, employeeCode: row.employeeCode, name: row.name }}
                  onSelect={onAction}
                />
              </td>
              {COLUMNS.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "px-3 py-2 whitespace-nowrap text-ink-muted group-hover:bg-accent-soft/50",
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
