import { Suspense } from "react";
import { ManagementDashboardView } from "@/features/connect/tasks/task-governance-views";

export const instant = false;

export default function ConnectExecutiveMonitoringPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-7xl mx-auto text-xs text-ink-muted">Loading Executive Monitoring...</div>}>
      <ManagementDashboardView />
    </Suspense>
  );
}
