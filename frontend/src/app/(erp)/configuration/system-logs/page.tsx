import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { configurationWorkspace, systemLogs } from "@/features/configuration/navigation";

export const instant = false;

export const metadata: Metadata = { title: "System Logs" };

export default function SystemLogsPage() {
  return (
    <WorkspaceView
      workspace={{
        ...configurationWorkspace,
        id: "system-logs",
        label: systemLogs.label,
        href: systemLogs.href ?? configurationWorkspace.href,
        description: "Audit trail of changes, exports and sign-ins.",
        shortcuts: undefined,
        cards: [systemLogs],
      }}
    />
  );
}
