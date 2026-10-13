"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  type EmployeeActionDefinition,
  type EmployeeActionTarget,
} from "../actions/employee-actions";

export interface OpenEmployeeAction {
  action: EmployeeActionDefinition;
  employee: EmployeeActionTarget;
}

export function EmployeeActionPanel({ current, onClose }: { current: OpenEmployeeAction | null; onClose: () => void }) {
  const open = current !== null;
  const Panel = current?.action.Panel;

  return (
    <Dialog
      open={open}
      size="lg"
      title={current?.action.label ?? ""}
      description={current && `${current.employee.employeeCode} · ${current.employee.name}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {open && Panel && <Panel action={current.action} employee={current.employee} />}
    </Dialog>
  );
}
