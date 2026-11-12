import { Suspense } from "react";
import { UnifiedTaskHub } from "@/features/connect/tasks/unified-task-hub";

export const instant = false;

export default function ConnectMyTasksPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-7xl mx-auto text-xs text-ink-muted">Loading My Tasks...</div>}>
      <UnifiedTaskHub />
    </Suspense>
  );
}
