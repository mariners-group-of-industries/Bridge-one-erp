import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { configurationWorkspace, identitySecurity } from "@/features/configuration/navigation";

export const instant = false;

export const metadata: Metadata = { title: "Identity & Security" };

export default function SecurityPage() {
  return (
    <WorkspaceView
      workspace={{
        ...configurationWorkspace,
        id: "identity-security",
        label: identitySecurity.label,
        href: identitySecurity.href ?? configurationWorkspace.href,
        description: "Approval pipelines, user groups and permission groups.",
        shortcuts: undefined,
        cards: [identitySecurity],
      }}
    />
  );
}
