import type { Metadata } from "next";
import { AuditLogView } from "@/features/configuration/system-logs/components/AuditLogView";

export const instant = false;

export const metadata: Metadata = { title: "Audit Logs" };

export default function AuditLogsPage() {
  return <AuditLogView />;
}
