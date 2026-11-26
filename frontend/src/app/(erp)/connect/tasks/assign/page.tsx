import { Suspense } from "react";
import { AssignTaskView } from "@/features/connect/tasks/task-portal-views";

export const instant = false;

export default function ConnectAssignTaskPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-7xl mx-auto text-xs text-ink-muted">Loading Assign Task Form...</div>}>
      <AssignTaskView />
    </Suspense>
  );
}
