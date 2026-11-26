import { Suspense } from "react";
import { EmployeePerformanceView } from "@/features/connect/tasks/task-governance-views";

export const instant = false;

export default function ConnectEmployeePerformancePage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-7xl mx-auto text-xs text-ink-muted">Loading Performance Analytics...</div>}>
      <EmployeePerformanceView />
    </Suspense>
  );
}
