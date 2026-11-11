import { Suspense } from "react";
import { TaskSettingsView } from "@/features/connect/tasks/task-governance-views";

export const instant = false;

export default function ConnectTaskSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-7xl mx-auto text-xs text-ink-muted">Loading Task Settings...</div>}>
      <TaskSettingsView />
    </Suspense>
  );
}
