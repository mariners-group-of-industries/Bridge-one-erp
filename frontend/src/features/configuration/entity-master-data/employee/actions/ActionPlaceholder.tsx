import { ReadOnlyField } from "@/components/ui/form-field";
import type { EmployeeActionPanelProps } from "./employee-actions";

export function ActionPlaceholder({ action, employee }: EmployeeActionPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Employee Id" value={employee.employeeCode} />
        <ReadOnlyField label="Employee Name" value={employee.name} />
      </div>
      <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
        {action.label} is not available yet. Its fields will be added once they are defined.
      </p>
    </div>
  );
}
