import { Suspense } from "react";
import { UnifiedTaskHub } from "@/features/connect/tasks/unified-task-hub";

export const instant = false;

export default function ConnectTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-xs text-ink-muted flex items-center gap-2">
            <span className="size-2 rounded-full bg-blue-600 animate-ping" />
            <span>Loading Task Hub...</span>
          </div>
        </div>
      }
    >
      <UnifiedTaskHub />
    </Suspense>
  );
}
