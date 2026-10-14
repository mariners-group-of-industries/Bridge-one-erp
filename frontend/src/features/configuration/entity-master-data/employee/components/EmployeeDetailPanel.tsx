"use client";

import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatCompanyDate, formatCompanyDateTime } from "@/lib/format";
import { entityMasterDataPaths } from "../../paths";
import { USER_ROLE_LABELS, type EmployeeListRow } from "../schemas/employee.schema";
import { Avatar, ReadValue, StatusBadge } from "./kit";

interface EmployeeDetailPanelProps {
  employee: EmployeeListRow | null;
  onClose: () => void;
}

/** Side drawer with the selected row's details, opened from the employee name. */
export function EmployeeDetailPanel({ employee, onClose }: EmployeeDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const open = employee !== null;

  useEffect(() => {
    if (!employee) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [employee, onClose]);

  useEffect(() => {
    if (employee) panelRef.current?.focus();
  }, [employee]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={employee ? `${employee.name} — employee details` : "Employee details"}
        tabIndex={-1}
        inert={!open}
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-dropdown outline-none transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {employee && <Avatar name={employee.name} />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="truncate text-base font-semibold text-ink">{employee?.name ?? ""}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span className="tabular-nums">{employee?.employeeCode}</span>
              {employee && <StatusBadge active={employee.isActive} />}
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {employee && (
            <div className="flex flex-col divide-y divide-line">
              <DrawerSection title="Work">
                <ReadValue label="Designation" value={employee.designation} />
                <ReadValue label="Department" value={employee.department} />
                <ReadValue label="Office" value={employee.officeName} />
                <ReadValue label="Employee Type" value={employee.employeeType} />
              </DrawerSection>
              <DrawerSection title="Identity">
                <ReadValue label="Employee Id" value={employee.employeeCode} />
                <ReadValue label="Attendance Id" value={employee.attendanceId} />
              </DrawerSection>
              <DrawerSection title="Employment">
                <ReadValue
                  label="Joining Date"
                  value={<time dateTime={employee.joiningDate}>{formatCompanyDate(employee.joiningDate, employee.dateFormat)}</time>}
                />
                <ReadValue
                  label="Termination Date"
                  value={
                    employee.terminationDate && (
                      <time dateTime={employee.terminationDate}>
                        {formatCompanyDate(employee.terminationDate, employee.dateFormat)}
                      </time>
                    )
                  }
                />
              </DrawerSection>
              <DrawerSection title="Access">
                <ReadValue label="Mobile / User" value={employee.mobile} />
                <ReadValue label="User Role" value={employee.userRole ? USER_ROLE_LABELS[employee.userRole] : null} />
              </DrawerSection>
              <DrawerSection title="Last Change">
                <ReadValue label="By" value={employee.lastActionBy} />
                <ReadValue
                  label="At"
                  value={
                    <time dateTime={employee.lastActionAt}>
                      {formatCompanyDateTime(employee.lastActionAt, employee.dateFormat)}
                    </time>
                  }
                />
              </DrawerSection>
            </div>
          )}
        </div>

        {employee && (
          <footer className="flex justify-end gap-2 border-t border-line bg-canvas px-5 py-3">
            <Button onClick={onClose}>Close</Button>
            <Link href={entityMasterDataPaths.employeeProfile(employee.id)} className={buttonClasses("accent", "md")}>
              Open Profile <ArrowUpRight />
            </Link>
          </footer>
        )}
      </div>
    </>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 px-5 py-4">
      <h3 className="text-xs font-semibold tracking-wide text-accent-strong uppercase dark:text-accent">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </section>
  );
}
