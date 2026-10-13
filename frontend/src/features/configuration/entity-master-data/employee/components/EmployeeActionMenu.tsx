"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { entityMasterDataPaths } from "../../paths";
import {
  EMPLOYEE_ACTIONS,
  type EmployeeActionDefinition,
  type EmployeeActionTarget,
} from "../actions/employee-actions";

interface EmployeeActionMenuProps {
  employee: EmployeeActionTarget;
  onSelect: (action: EmployeeActionDefinition, employee: EmployeeActionTarget) => void;
}

const ACTION_BUTTON = cn(buttonClasses("ghost", "icon"), "hover:bg-accent-soft hover:text-accent-strong");

/** Row actions: every action as an icon button, in the required order. */
export function EmployeeActionMenu({ employee, onSelect }: EmployeeActionMenuProps) {
  return (
    <div role="group" aria-label={`Actions for ${employee.name}`} className="flex items-center justify-center gap-0.5">
      {EMPLOYEE_ACTIONS.map((action) => {
        const Icon = action.icon;
        const label = `${action.label}: ${employee.name}`;
        return action.profileTab ? (
          <Link
            key={action.id}
            href={`${entityMasterDataPaths.employeeProfile(employee.employeeId)}?tab=${action.profileTab}`}
            title={action.label}
            aria-label={label}
            className={ACTION_BUTTON}
          >
            <Icon aria-hidden="true" />
          </Link>
        ) : (
          <button
            key={action.id}
            type="button"
            title={action.label}
            aria-label={label}
            onClick={() => onSelect(action, employee)}
            className={ACTION_BUTTON}
          >
            <Icon aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
