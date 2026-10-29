import type { Metadata } from "next";
import { WorkspaceView } from "@/components/layout/workspace-view";
import { configurationWorkspace, communityGateways } from "@/features/configuration/navigation";

export const instant = false;

export const metadata: Metadata = { title: "Community & Gateways" };

export default function GatewaysPage() {
  return (
    <WorkspaceView
      workspace={{
        ...configurationWorkspace,
        id: "gateways",
        label: communityGateways.label,
        href: communityGateways.href ?? configurationWorkspace.href,
        description: "API tokens for integrations.",
        shortcuts: undefined,
        cards: [communityGateways],
      }}
    />
  );
}
