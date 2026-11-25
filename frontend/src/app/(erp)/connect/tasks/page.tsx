import { Suspense } from "react";
import { TaskAllocationView } from "@/features/connect/tasks/task-allocation-view";

export const instant = false;

export default function ConnectTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-xs text-ink-muted flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary animate-ping" />
            <span>Loading Task Allocation...</span>
          </div>
        </div>
      }
    >
      <TaskAllocationView />
    </Suspense>
  );
}
